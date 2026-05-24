# Gauss–Seidel Numerical Method — Flask App

## PIT Project 2026

A Flask web application implementing the **Gauss–Seidel iterative method** for solving systems of linear equations $Ax = b$.

---

## Features

- **Theory tab**: Full mathematical discussion, algorithm pseudocode, convergence conditions, comparison with Jacobi
- **Examples tab**: Two fully worked step-by-step examples with MathJax-rendered equations
- **Calculator tab**: Interactive solver for 2×2 to 6×6 systems with:
  - Inline grid input for matrix A and vectors b, x₀
  - Configurable tolerance and max iterations
  - Preset examples
  - Iteration table and step-by-step breakdown

---

## Local Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
python app.py
# Open http://localhost:5000
```

---

## Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From project root: `vercel`
3. Follow prompts (Python project, auto-detected)
4. Your app will be live at `https://your-project.vercel.app`

---

## Project Structure

```
gauss-seidel/
├── app.py                  # Flask routes + Gauss-Seidel algorithm
├── requirements.txt
├── vercel.json             # Vercel deployment config
├── templates/
│   └── index.html          # Main template (Theory / Examples / Calculator)
└── static/
    ├── css/style.css
    └── js/main.js
```

---

## How User Input Is Safely Parsed

1. Matrix/vector values come from `<input type="number">` fields — browsers reject non-numeric input at the UI level.
2. Server-side, `parse_matrix()` and `parse_vector()` use `re.split` to tokenize and explicitly cast each token to `float()`, raising `ValueError` for any non-numeric string.
3. Matrix size `n` is validated to be an integer in `[2, 6]`.
4. Tolerance must be positive; max iterations bounded to `[1, 500]`.
5. All exceptions are caught and returned as JSON `{"error": "..."}` with HTTP 400 — never as server tracebacks.

---

## Algorithm Notes

- Core implementation in pure Python (no NumPy), as required.
- Uses in-place update: for row $i$, the most recently computed $x_j^{(k+1)}$ values (for $j < i$) are used immediately in the same sweep.
- Stopping criterion: $\max_i |x_i^{(k+1)} - x_i^{(k)}| < \varepsilon$
- Diagonal dominance is checked and reported as a warning (not a blocker).
