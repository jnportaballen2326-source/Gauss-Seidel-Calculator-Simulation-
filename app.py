from flask import Flask, render_template, request, jsonify
import re

app = Flask(__name__)


def gauss_seidel(A, b, x0=None, tol=None, max_iter=100):
    """
    Gauss-Seidel solver matching handwritten format:
    - Shows formula substitution per variable per iteration
    - Computes absolute relative approximate error (%) per variable
    - Stops when ALL errors drop below tol (%), or max_iter reached
    """
    n = len(A)

    # Diagonal dominance check
    dom_check = []
    for i in range(n):
        diag = abs(A[i][i])
        off = sum(abs(A[i][j]) for j in range(n) if j != i)
        dom_check.append({
            "row": i + 1,
            "diag": diag,
            "off_sum": off,
            "dominant": diag > off
        })

    # Build rearranged formulas: x_i = (b_i - sum_{j!=i} a_ij*x_j) / a_ii
    # Store coefficients for display
    formulas = []
    for i in range(n):
        terms = []
        for j in range(n):
            if j != i:
                coeff = -A[i][j] / A[i][i]
                terms.append({"var": j + 1, "coeff": coeff, "a_ij": A[i][j]})
        formulas.append({
            "var": i + 1,
            "b_over_aii": b[i] / A[i][i],
            "b_i": b[i],
            "a_ii": A[i][i],
            "terms": terms
        })

    # Initial guess
    x = [0.0] * n if x0 is None else list(map(float, x0))

    iterations = []

    for k in range(max_iter):
        x_old = x[:]
        row_details = []

        for i in range(n):
            # Build substitution string data
            sigma = sum(A[i][j] * x[j] for j in range(n) if j != i)
            x_new = (b[i] - sigma) / A[i][i]

            # For display: show each term substituted
            sub_terms = []
            for j in range(n):
                if j != i:
                    sub_terms.append({
                        "var": j + 1,
                        "coeff": A[i][j],
                        "value": x[j],          # value used (already updated if j<i)
                        "product": A[i][j] * x[j]
                    })

            # Relative approximate error (%)
            if k == 0 and x_old[i] == 0.0:
                # On first iteration x_old may be 0 — report 100% or N/A
                rel_err = abs(x_new - x_old[i]) / (abs(x_new) + 1e-15) * 100
            else:
                rel_err = abs(x_new - x_old[i]) / (abs(x_new) + 1e-15) * 100

            row_details.append({
                "var": i + 1,
                "a_ii": A[i][i],
                "b_i": b[i],
                "sub_terms": sub_terms,
                "sigma": sigma,
                "numerator": b[i] - sigma,
                "x_old": x_old[i],
                "x_new": x_new,
                "rel_err_pct": rel_err
            })
            x[i] = x_new

        max_err = max(r["rel_err_pct"] for r in row_details)

        iterations.append({
            "k": k + 1,
            "x_old": x_old,
            "x_new": x[:],
            "row_details": row_details,
            "max_err_pct": max_err
        })

        if tol is not None and max_err < tol:
            return build_result(True, x, iterations, k + 1, dom_check, formulas, tol)

    return build_result(tol is not None and False, x, iterations, max_iter, dom_check, formulas, tol)


def build_result(converged, x, iterations, num_iter, dom_check, formulas, tol):
    return {
        "converged": converged,
        "solution": x,
        "iterations": iterations,
        "num_iterations": num_iter,
        "dom_check": dom_check,
        "formulas": formulas,
        "tol": tol
    }


def parse_matrix(text, n):
    vals = re.split(r'[,\s]+', text.strip())
    vals = [v for v in vals if v]
    if len(vals) != n * n:
        raise ValueError(f"Expected {n*n} values for {n}x{n} matrix, got {len(vals)}.")
    return [[float(vals[i * n + j]) for j in range(n)] for i in range(n)]


def parse_vector(text, n):
    vals = re.split(r'[,\s]+', text.strip())
    vals = [v for v in vals if v]
    if len(vals) != n:
        raise ValueError(f"Expected {n} values for vector, got {len(vals)}.")
    return [float(v) for v in vals]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        data = request.get_json()
        n = int(data.get("n", 3))
        if n < 2 or n > 6:
            return jsonify({"error": "Matrix size must be between 2 and 6."}), 400

        A = parse_matrix(data.get("A", ""), n)
        b = parse_vector(data.get("b", ""), n)

        x0_text = data.get("x0", "").strip()
        x0 = parse_vector(x0_text, n) if x0_text else None

        tol_raw = data.get("tol", "").strip()
        tol = float(tol_raw) if tol_raw else None   # tol is in %, e.g. 0.5 means stop at <0.5%

        max_iter = int(data.get("max_iter", 100))
        if max_iter < 1 or max_iter > 500:
            return jsonify({"error": "Max iterations must be between 1 and 500."}), 400

        # Check zero diagonal
        for i in range(n):
            if A[i][i] == 0:
                return jsonify({"error": f"Zero diagonal at row {i+1}. Rearrange equations so diagonal entries are non-zero."}), 400

        result = gauss_seidel(A, b, x0=x0, tol=tol, max_iter=max_iter)
        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
