const express = require('express');
const cors = require('cors');
const { prepare, transaction } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Weeks ───────────────────────────────────────────────────────────────────

app.get('/api/weeks', (req, res) => {
  const weeks = prepare('SELECT * FROM weeks ORDER BY start_date DESC').all();
  res.json(weeks);
});

app.post('/api/weeks', (req, res) => {
  const { start_date } = req.body;
  if (!start_date) return res.status(400).json({ error: 'start_date required' });
  try {
    const result = prepare('INSERT INTO weeks (start_date) VALUES (?)').run(start_date);
    const week = prepare('SELECT * FROM weeks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(week);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      const week = prepare('SELECT * FROM weeks WHERE start_date = ?').get(start_date);
      res.json(week);
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

app.get('/api/weeks/:id', (req, res) => {
  const week = prepare('SELECT * FROM weeks WHERE id = ?').get(req.params.id);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const meals = prepare('SELECT * FROM meals WHERE week_id = ?').all(week.id);

  for (const meal of meals) {
    if (meal.recipe_id) {
      meal.recipe = prepare('SELECT * FROM recipes WHERE id = ?').get(meal.recipe_id);
      if (meal.recipe) {
        meal.recipe.ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(meal.recipe_id);
      }
    }
    meal.meal_ingredients = prepare(`
      SELECT mi.*, i.quantity as orig_quantity, i.unit, i.name
      FROM meal_ingredients mi
      JOIN ingredients i ON mi.ingredient_id = i.id
      WHERE mi.meal_id = ?
    `).all(meal.id);
  }

  res.json({ ...week, meals });
});

app.post('/api/weeks/:id/copy', (req, res) => {
  const { target_week_id } = req.body;
  if (!target_week_id) return res.status(400).json({ error: 'target_week_id required' });

  const sourceWeek = prepare('SELECT * FROM weeks WHERE id = ?').get(req.params.id);
  if (!sourceWeek) return res.status(404).json({ error: 'Source week not found' });
  const targetWeek = prepare('SELECT * FROM weeks WHERE id = ?').get(target_week_id);
  if (!targetWeek) return res.status(404).json({ error: 'Target week not found' });

  const sourceMeals = prepare('SELECT * FROM meals WHERE week_id = ?').all(sourceWeek.id);

  const copyMeals = transaction(() => {
    for (const meal of sourceMeals) {
      if (!meal.recipe_id) continue;
      const existing = prepare(
        'SELECT id FROM meals WHERE week_id = ? AND day_of_week = ? AND meal_type = ?'
      ).get(target_week_id, meal.day_of_week, meal.meal_type);

      let mealId;
      if (existing) {
        prepare('UPDATE meals SET recipe_id = ?, prep_time_minutes = NULL, rating = NULL, notes = NULL WHERE id = ?')
          .run(meal.recipe_id, existing.id);
        mealId = existing.id;
        prepare('DELETE FROM meal_ingredients WHERE meal_id = ?').run(mealId);
      } else {
        const result = prepare(
          'INSERT INTO meals (week_id, day_of_week, meal_type, recipe_id) VALUES (?, ?, ?, ?)'
        ).run(target_week_id, meal.day_of_week, meal.meal_type, meal.recipe_id);
        mealId = result.lastInsertRowid;
      }

      const ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(meal.recipe_id);
      for (const ing of ingredients) {
        prepare(
          'INSERT INTO meal_ingredients (meal_id, ingredient_id, custom_quantity, purchased) VALUES (?, ?, ?, 0)'
        ).run(mealId, ing.id, ing.quantity);
      }
    }
  });

  copyMeals();
  res.json({ success: true });
});

// ─── Meals ────────────────────────────────────────────────────────────────────

app.get('/api/meals/:id', (req, res) => {
  const meal = prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  if (meal.recipe_id) {
    meal.recipe = prepare('SELECT * FROM recipes WHERE id = ?').get(meal.recipe_id);
    if (meal.recipe) {
      meal.recipe.ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(meal.recipe_id);
    }
  }
  meal.meal_ingredients = prepare(`
    SELECT mi.*, i.quantity as orig_quantity, i.unit, i.name
    FROM meal_ingredients mi
    JOIN ingredients i ON mi.ingredient_id = i.id
    WHERE mi.meal_id = ?
  `).all(meal.id);
  res.json(meal);
});

app.post('/api/meals', (req, res) => {
  const { week_id, day_of_week, meal_type, recipe_id } = req.body;
  if (week_id == null || day_of_week == null || !meal_type) {
    return res.status(400).json({ error: 'week_id, day_of_week, meal_type required' });
  }
  try {
    const createMeal = transaction(() => {
      const result = prepare(
        'INSERT INTO meals (week_id, day_of_week, meal_type, recipe_id) VALUES (?, ?, ?, ?)'
      ).run(week_id, day_of_week, meal_type, recipe_id || null);
      const mealId = result.lastInsertRowid;

      if (recipe_id) {
        const ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipe_id);
        for (const ing of ingredients) {
          prepare(
            'INSERT INTO meal_ingredients (meal_id, ingredient_id, custom_quantity, purchased) VALUES (?, ?, ?, 0)'
          ).run(mealId, ing.id, ing.quantity);
        }
      }
      return prepare('SELECT * FROM meals WHERE id = ?').get(mealId);
    });
    res.status(201).json(createMeal());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/meals/:id', (req, res) => {
  const { prep_time_minutes, rating, notes, recipe_id } = req.body;
  const meal = prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });

  const updateMeal = transaction(() => {
    // Update fields individually to avoid COALESCE null-masking issues with node:sqlite
    if (prep_time_minutes !== undefined) prepare('UPDATE meals SET prep_time_minutes = ? WHERE id = ?').run(prep_time_minutes, req.params.id);
    if (rating !== undefined) prepare('UPDATE meals SET rating = ? WHERE id = ?').run(rating, req.params.id);
    if (notes !== undefined) prepare('UPDATE meals SET notes = ? WHERE id = ?').run(notes, req.params.id);
    if (recipe_id !== undefined) {
      prepare('UPDATE meals SET recipe_id = ? WHERE id = ?').run(recipe_id, req.params.id);
      if (recipe_id !== meal.recipe_id) {
        prepare('DELETE FROM meal_ingredients WHERE meal_id = ?').run(req.params.id);
        if (recipe_id) {
          const ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipe_id);
          for (const ing of ingredients) {
            prepare(
              'INSERT INTO meal_ingredients (meal_id, ingredient_id, custom_quantity, purchased) VALUES (?, ?, ?, 0)'
            ).run(req.params.id, ing.id, ing.quantity);
          }
        }
      }
    }
  });

  updateMeal();
  const updated = prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/meals/:id', (req, res) => {
  prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Meal Ingredients ─────────────────────────────────────────────────────────

app.put('/api/meal_ingredients/:id', (req, res) => {
  const { purchased } = req.body;
  prepare('UPDATE meal_ingredients SET purchased = ? WHERE id = ?').run(purchased ? 1 : 0, req.params.id);
  const mi = prepare('SELECT * FROM meal_ingredients WHERE id = ?').get(req.params.id);
  res.json(mi);
});

// ─── Recipes ─────────────────────────────────────────────────────────────────

app.get('/api/recipes', (req, res) => {
  const recipes = prepare('SELECT * FROM recipes ORDER BY name ASC').all();
  res.json(recipes);
});

app.post('/api/recipes', (req, res) => {
  const { name, instructions, prep_time_minutes, ingredients } = req.body;
  if (!name || !instructions) return res.status(400).json({ error: 'name and instructions required' });

  try {
    const createRecipe = transaction(() => {
      const result = prepare(
        'INSERT INTO recipes (name, instructions, prep_time_minutes) VALUES (?, ?, ?)'
      ).run(name, instructions, prep_time_minutes || null);
      const recipeId = result.lastInsertRowid;

      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) {
          prepare(
            'INSERT INTO ingredients (recipe_id, quantity, unit, name) VALUES (?, ?, ?, ?)'
          ).run(recipeId, ing.quantity || null, ing.unit || null, ing.name);
        }
      }
      return prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
    });

    const recipe = createRecipe();
    recipe.ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipe.id);
    res.status(201).json(recipe);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'A recipe with that name already exists' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

app.get('/api/recipes/:id', (req, res) => {
  const recipe = prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  recipe.ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipe.id);
  res.json(recipe);
});

app.put('/api/recipes/:id', (req, res) => {
  const { name, instructions, prep_time_minutes, ingredients } = req.body;
  const recipe = prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  try {
    const updateRecipe = transaction(() => {
      if (name) prepare('UPDATE recipes SET name = ? WHERE id = ?').run(name, req.params.id);
      if (instructions) prepare('UPDATE recipes SET instructions = ? WHERE id = ?').run(instructions, req.params.id);
      if (prep_time_minutes !== undefined) prepare('UPDATE recipes SET prep_time_minutes = ? WHERE id = ?').run(prep_time_minutes, req.params.id);

      if (ingredients !== undefined) {
        // Remove meal_ingredients that reference the old ingredient rows before deleting them
        prepare(`
          DELETE FROM meal_ingredients WHERE ingredient_id IN (
            SELECT id FROM ingredients WHERE recipe_id = ?
          )
        `).run(req.params.id);
        prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(req.params.id);
        for (const ing of ingredients) {
          prepare(
            'INSERT INTO ingredients (recipe_id, quantity, unit, name) VALUES (?, ?, ?, ?)'
          ).run(req.params.id, ing.quantity || null, ing.unit || null, ing.name);
        }
        // Re-populate meal_ingredients for any meals still assigned to this recipe
        const affectedMeals = prepare('SELECT id FROM meals WHERE recipe_id = ?').all(req.params.id);
        const newIngredients = prepare('SELECT id, quantity FROM ingredients WHERE recipe_id = ?').all(req.params.id);
        for (const meal of affectedMeals) {
          for (const ing of newIngredients) {
            prepare(
              'INSERT INTO meal_ingredients (meal_id, ingredient_id, custom_quantity, purchased) VALUES (?, ?, ?, 0)'
            ).run(meal.id, ing.id, ing.quantity);
          }
        }
      }
    });

    updateRecipe();
    const updated = prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
    updated.ingredients = prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/recipes/:id', (req, res) => {
  prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Meal Tracker API running on http://localhost:${PORT}`);
});
