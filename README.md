# Meal Tracker

A full-featured Lunch & Dinner planning web app. Plan your week, track ingredient shopping, log prep times, rate meals, and build a personal recipe library — all in one place.

## What It Does

- **Weekly meal planning** — a Mon–Sun grid with Lunch and Dinner slots for each day
- **Recipe library** — store recipes with step-by-step instructions, ingredients, and prep times
- **Ingredient tracking** — check off ingredients as you shop, with a per-cell progress indicator and Check All / Uncheck All button
- **Shopping list** — all unpurchased ingredients for the week combined and deduplicated, with quantities summed; exportable as a .txt file
- **Meal logging** — log actual prep time and a 1–5 star rating after cooking
- **Past weeks** — browse previous weeks and "pull forward" any week's plan into the current week
- **Inline recipe creation** — create new recipes directly from the meal assignment modal
- **Reports** — charts and stats for ratings and prep times (overall, lunch, dinner, and by week), plus a downloadable notes export

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later

## Setup

### First time only

```bash
# 1. Clone / download the project
cd meal-tracker

# 2. Install all dependencies (root + backend + frontend) — one-time step
npm run install:all
```

### Every time you want to run the app

```bash
npm run dev
```

Then open **http://localhost:5173** in your browser.

> You only need to run `npm run install:all` again if you pull updates that add new packages.

## Project Structure

```
meal-tracker/
├── package.json            # Root — runs both servers with concurrently
├── backend/
│   ├── server.js           # Express REST API (port 3001)
│   ├── db.js               # SQLite schema & connection (better-sqlite3)
│   └── meal-tracker.db     # Auto-created on first run
└── frontend/
    ├── vite.config.js      # Proxies /api → localhost:3001
    └── src/
        ├── App.jsx          # Router + nav shell
        ├── index.css        # All styles (CSS variables, no frameworks)
        └── components/
            ├── WeekView.jsx      # Main weekly grid page + shopping list modal
            ├── MealSlot.jsx      # Individual day/meal cell
            ├── MealForm.jsx      # Modal: assign recipe, manage ingredients, log rating
            ├── RecipeLibrary.jsx # Browse, create, edit, delete recipes
            ├── PastWeeks.jsx     # History + pull-forward feature
            └── Reports.jsx       # Charts and stats for ratings, prep times, and notes
```

## Feature Walkthrough

### Planning the Week (Home `/`)

The home page automatically creates a week for the current Monday (if one doesn't exist) and shows a 7-column grid. Each column is a day of the week; each column has a **Lunch** and **Dinner** slot.

Each filled cell shows:
- Recipe name
- Star rating (if logged)
- Prep time (if logged)
- Ingredient purchase progress bar (e.g. "3/5 ingredients")

**Click any slot** to open the meal modal.

### Assigning a Meal

In the modal's **Recipe** tab:
1. Type in the search box to filter existing recipes, then click one to select it.
2. Or click **Create new recipe "…"** at the bottom of the dropdown to create one inline.
3. Hit **Add to Week** (or **Update Recipe** for an existing assignment).

### Creating a Recipe Inline

When creating a recipe inline from the meal modal, fill in:
- Recipe name
- Prep time (optional)
- Step-by-step instructions
- Ingredients (quantity, unit, name — add as many rows as needed)

The recipe is saved to the library and immediately assigned to the slot.

### Tracking Ingredients

After assigning a recipe, the modal's **Ingredients** tab shows each ingredient with a checkbox. Check them off as you shop. The week view cell updates the progress bar in real time.

### Rating & Logging

After cooking, open the slot and go to the **Rate & Log** tab:
- Click stars to rate 1–5 (click the same star again to clear)
- Enter actual prep time in minutes
- Add notes (modifications, tips, etc.)

### Recipe Library (`/recipes`)

- Browse all saved recipes in a card grid
- Search by name
- Click a card to view full details (ingredients + instructions)
- Edit or delete any recipe

### Past Weeks (`/past-weeks`)

Lists all weeks with meal counts. Two actions per week:
- **View** — navigate to that week's grid
- **Pull Forward** — copy the recipe assignments into the current week (or any other week). Ratings, notes, and purchase status are not copied.

### Week Navigation

Use the **← Prev** / **Next →** buttons on any week view to move between weeks. Navigating forward past the last saved week automatically creates a new blank week.

### Shopping List

Click **🛒 Shopping List** in the top-right of any week view to open the shopping list modal. It shows all unpurchased ingredients for the week:
- Duplicate ingredients (same name and unit) are combined into one line with quantities summed
- Numeric quantities are added up; fractions like `1/2` and `1 1/4` are supported
- Items appearing in multiple meals show a badge (e.g. "3 meals")
- Click **⬇ Export .txt** to download the list as a text file named `shopping-list-YYYY-MM-DD.txt`

### Reports (`/reports`)

The Reports page provides stats and charts across all your logged meals:

- **Stat cards** — Overall, Lunch, and Dinner averages for both rating (★) and prep time (min)
- **Weekly Ratings chart** — grouped bar chart showing overall, lunch, and dinner average ratings by week
- **Weekly Prep Time chart** — same view for prep times in minutes
- **Notes** — a table of every meal that has notes logged, showing date, meal type, recipe, rating, prep time, and the note text
- **⬇ Download Notes (.txt)** — exports all notes to a formatted text file

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/weeks` | List all weeks |
| POST | `/api/weeks` | Create a week |
| GET | `/api/weeks/:id` | Full week detail (meals + recipes + ingredients) |
| POST | `/api/weeks/:id/copy` | Copy week's meals to another week |
| GET | `/api/meals/:id` | Get meal detail |
| POST | `/api/meals` | Create meal |
| PUT | `/api/meals/:id` | Update meal (rating, prep time, notes, recipe) |
| DELETE | `/api/meals/:id` | Remove meal |
| PUT | `/api/meal_ingredients/:id` | Toggle purchased status |
| GET | `/api/reports` | Aggregated ratings, prep times, and notes for reports |
| GET | `/api/recipes` | List all recipes |
| POST | `/api/recipes` | Create recipe with ingredients |
| GET | `/api/recipes/:id` | Get recipe with ingredients |
| PUT | `/api/recipes/:id` | Update recipe + ingredients |
| DELETE | `/api/recipes/:id` | Delete recipe |

## Tech Stack

- **Frontend**: React 18, React Router v6, Vite, plain CSS (no component library)
- **Backend**: Express.js, better-sqlite3
- **Database**: SQLite (file-based, zero config)
- **Dev runner**: concurrently
