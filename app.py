from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db_connection

app = Flask(__name__)
CORS(app)


# ==========================================
# DATABASE HELPERS
# ==========================================

def get_connection():
    return get_db_connection()


def close_db(cursor=None, connection=None):
    if cursor:
        cursor.close()
    if connection:
        connection.close()


def error_response(message, status=500):
    return jsonify({
        "success": False,
        "message": message
    }), status


# ==========================================
# HOME / HEALTH CHECK
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "SkillBridge Backend is Running!"
    })


@app.route("/test-db", methods=["GET"])
def test_db():
    connection = None

    try:
        connection = get_connection()

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

        return jsonify({
            "success": True,
            "message": "SkillBridge database connected successfully!"
        })

    except Exception:
        app.logger.exception("Database connection failed")
        return error_response("Database connection failed.", 500)

    finally:
        if connection:
            connection.close()


@app.route("/api/test", methods=["GET"])
def api_test():
    return jsonify({
        "success": True,
        "message": "Frontend can communicate with SkillBridge backend!"
    })


# ==========================================
# SIGN UP
# ==========================================

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    full_name = str(data.get("full_name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name or not email or not password:
        return error_response("Please fill in all fields.", 400)

    if len(password) < 8:
        return error_response(
            "Password must be at least 8 characters.",
            400
        )

    if len(full_name) > 150 or len(email) > 254:
        return error_response("Name or email is too long.", 400)

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT user_id FROM users WHERE LOWER(email) = %s",
            (email,)
        )

        if cursor.fetchone():
            return error_response(
                "An account with this email already exists.",
                409
            )

        password_hash = generate_password_hash(password)

        cursor.execute(
            """
            INSERT INTO users (full_name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING user_id, full_name, email
            """,
            (full_name, email, password_hash)
        )

        user = cursor.fetchone()
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Account created successfully!",
            "user": {
                "user_id": user[0],
                "full_name": user[1],
                "email": user[2]
            }
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Signup failed")
        return error_response(
            "Unable to create your account. Please try again.",
            500
        )

    finally:
        close_db(cursor, connection)


# ==========================================
# LOG IN
# ==========================================

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return error_response(
            "Please enter your email and password.",
            400
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT user_id, full_name, email, password_hash
            FROM users
            WHERE LOWER(email) = %s
            """,
            (email,)
        )

        user = cursor.fetchone()

        if not user or not check_password_hash(user[3], password):
            return error_response(
                "Invalid email or password.",
                401
            )

        return jsonify({
            "success": True,
            "message": "Login successful!",
            "user": {
                "user_id": user[0],
                "full_name": user[1],
                "email": user[2]
            }
        })

    except Exception:
        app.logger.exception("Login failed")
        return error_response("Unable to log in right now.", 500)

    finally:
        close_db(cursor, connection)


# ==========================================
# GET ALL CAREER DOMAINS
# ==========================================

@app.route("/api/domains", methods=["GET"])
def get_domains():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT domain_id, domain_name, description
            FROM career_domains
            ORDER BY domain_name
            """
        )

        columns = [column[0] for column in cursor.description]
        domains = [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]

        return jsonify({
            "success": True,
            "count": len(domains),
            "domains": domains
        })

    except Exception:
        app.logger.exception("Fetching domains failed")
        return error_response("Unable to fetch domains.")

    finally:
        close_db(cursor, connection)


# ==========================================
# GET SKILLS FOR A DOMAIN
# Includes difficulty and priority.
# ==========================================

@app.route("/api/domains/<int:domain_id>/skills", methods=["GET"])
def get_domain_skills(domain_id):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Priority is included because it exists in the
        # current SkillBridge skills table.
        cursor.execute(
            """
            SELECT
                skill_id,
                domain_id,
                skill_name,
                description,
                difficulty_level,
                priority
            FROM skills
            WHERE domain_id = %s
            ORDER BY
                CASE LOWER(COALESCE(priority, 'important'))
                    WHEN 'high' THEN 1
                    WHEN 'critical' THEN 1
                    WHEN 'important' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END,
                skill_name
            """,
            (domain_id,)
        )

        columns = [column[0] for column in cursor.description]
        skills = [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]

        return jsonify({
            "success": True,
            "domain_id": domain_id,
            "count": len(skills),
            "skills": skills
        })

    except Exception:
        app.logger.exception("Fetching skills failed")
        return error_response(
            "Unable to fetch skills. Check the skills table schema."
        )

    finally:
        close_db(cursor, connection)


# ==========================================
# GET QUESTIONS FOR A SKILL
# Correct answers are NEVER sent to the frontend.
#
# Optional query parameters:
# skill_id=5
# difficulty=Basic
# limit=20
#
# If no questions exist at the requested difficulty,
# fall back to available questions for that skill.
# ==========================================

@app.route("/api/questions", methods=["GET"])
def get_questions():
    skill_id = request.args.get("skill_id", type=int)
    difficulty = request.args.get(
        "difficulty", default="Basic", type=str
    ).strip().title()

    limit = request.args.get("limit", default=20, type=int)

    if not skill_id or skill_id <= 0:
        return error_response("Please provide a valid skill_id.", 400)

    if difficulty not in ("Basic", "Intermediate", "Advanced"):
        return error_response(
            "Difficulty must be Basic, Intermediate, or Advanced.",
            400
        )

    if limit is None or limit < 1 or limit > 100:
        return error_response(
            "Question limit must be between 1 and 100.",
            400
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                question_id,
                skill_id,
                question_text,
                option_a,
                option_b,
                option_c,
                option_d,
                difficulty_level,
                explanation
            FROM quiz_questions
            WHERE skill_id = %s
              AND LOWER(TRIM(COALESCE(difficulty_level, '')))
                  = LOWER(%s)
            ORDER BY question_id
            LIMIT %s
            """,
            (skill_id, difficulty, limit)
        )

        rows = cursor.fetchall()
        used_difficulty = difficulty

        # Fallback: don't return an empty quiz if the skill
        # has questions, but none at the requested difficulty.
        if not rows:
            cursor.execute(
                """
                SELECT
                    question_id,
                    skill_id,
                    question_text,
                    option_a,
                    option_b,
                    option_c,
                    option_d,
                    difficulty_level,
                    explanation
                FROM quiz_questions
                WHERE skill_id = %s
                ORDER BY
                    CASE LOWER(COALESCE(difficulty_level, ''))
                        WHEN 'basic' THEN 1
                        WHEN 'intermediate' THEN 2
                        WHEN 'advanced' THEN 3
                        ELSE 4
                    END,
                    question_id
                LIMIT %s
                """,
                (skill_id, limit)
            )

            rows = cursor.fetchall()

            if rows:
                used_difficulty = "Mixed"

        columns = [column[0] for column in cursor.description]
        questions = [
            dict(zip(columns, row))
            for row in rows
        ]

        return jsonify({
            "success": True,
            "skill_id": skill_id,
            "requested_difficulty": difficulty,
            "difficulty": used_difficulty,
            "count": len(questions),
            "questions": questions
        })

    except Exception:
        app.logger.exception("Fetching questions failed")
        return error_response("Unable to fetch questions.")

    finally:
        close_db(cursor, connection)


# ==========================================
# SUBMIT ASSESSMENT
# Scores are calculated on the backend.
# Results are stored in quiz_results.
# ==========================================

@app.route("/api/assessment/submit", methods=["POST"])
def submit_assessment():
    data = request.get_json(silent=True) or {}

    answers = data.get("answers")
    user_id = data.get("user_id")

    if not isinstance(answers, list) or not answers:
        return error_response("No answers were submitted.", 400)

    if len(answers) > 100:
        return error_response(
            "A maximum of 100 answers can be submitted at once.",
            400
        )

    if user_id is not None:
        if (
            not isinstance(user_id, int)
            or isinstance(user_id, bool)
            or user_id <= 0
        ):
            return error_response("Invalid user_id.", 400)

    submitted_answers = {}

    for item in answers:
        if not isinstance(item, dict):
            return error_response("Invalid answer data.", 400)

        question_id = item.get("question_id")
        choice = item.get("answer")

        if (
            not isinstance(question_id, int)
            or isinstance(question_id, bool)
            or question_id <= 0
            or not isinstance(choice, str)
            or choice.strip().upper() not in ("A", "B", "C", "D")
        ):
            return error_response("Invalid answer data.", 400)

        if question_id in submitted_answers:
            return error_response(
                "Duplicate questions submitted.",
                400
            )

        submitted_answers[question_id] = choice.strip().upper()

    question_ids = list(submitted_answers.keys())
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                question_id,
                correct_answer,
                skill_id,
                difficulty_level
            FROM quiz_questions
            WHERE question_id = ANY(%s)
            """,
            (question_ids,)
        )

        rows = cursor.fetchall()

        if len(rows) != len(question_ids):
            return error_response(
                "One or more questions were not found.",
                400
            )

        details = {
            row[0]: {
                "correct": str(row[1]).strip().upper(),
                "skill_id": row[2],
                "difficulty": str(row[3] or "").strip().title()
            }
            for row in rows
        }

        skill_ids = {
            item["skill_id"]
            for item in details.values()
        }

        if len(skill_ids) != 1 or None in skill_ids:
            return error_response(
                "All questions must belong to the same valid skill.",
                400
            )

        skill_id = next(iter(skill_ids))

        valid_levels = {"Basic", "Intermediate", "Advanced"}
        levels = {
            item["difficulty"]
            for item in details.values()
        }

        if not levels.issubset(valid_levels):
            return error_response(
                "Question difficulty is missing or invalid in the database.",
                400
            )

        skill_level = (
            next(iter(levels)) if len(levels) == 1 else "Mixed"
        )

        score = sum(
            1
            for question_id, choice in submitted_answers.items()
            if details[question_id]["correct"] == choice
        )

        total = len(submitted_answers)
        percentage = round(score * 100 / total)

        # Confirm the user exists before saving a result.
        if user_id is not None:
            cursor.execute(
                "SELECT user_id FROM users WHERE user_id = %s",
                (user_id,)
            )

            if not cursor.fetchone():
                return error_response("User not found.", 404)

        cursor.execute(
            """
            INSERT INTO quiz_results (
                user_id,
                skill_id,
                score,
                total_questions,
                skill_level
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING result_id, attempted_at
            """,
            (user_id, skill_id, score, total, skill_level)
        )

        saved_result = cursor.fetchone()
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Assessment evaluated and saved successfully.",
            "result_id": saved_result[0],
            "user_id": user_id,
            "skill_id": skill_id,
            "skill_level": skill_level,
            "score": score,
            "total": total,
            "percentage": percentage,
            "attempted_at": (
                saved_result[1].isoformat()
                if saved_result[1]
                else None
            )
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Assessment submission failed")
        return error_response(
            "Unable to evaluate and save the assessment."
        )

    finally:
        close_db(cursor, connection)


# ==========================================
# GET PROGRESS REPORT
# GET /api/progress?user_id=1
#
# Uses actual saved assessment results.
# ==========================================

@app.route("/api/progress", methods=["GET"])
def get_progress():
    user_id = request.args.get("user_id", type=int)

    if not user_id or user_id <= 0:
        return error_response(
            "Please provide a valid user_id.",
            400
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT user_id FROM users WHERE user_id = %s",
            (user_id,)
        )

        if not cursor.fetchone():
            return error_response("User not found.", 404)

        cursor.execute(
            """
            SELECT
                s.skill_id,
                s.skill_name,
                s.domain_id,
                d.domain_name,
                s.difficulty_level,
                s.priority,
                COUNT(qr.result_id) AS attempts,
                COALESCE(SUM(qr.score), 0) AS total_correct,
                COALESCE(SUM(qr.total_questions), 0) AS total_questions,
                MAX(qr.attempted_at) AS last_attempt
            FROM skills s
            LEFT JOIN career_domains d
                ON d.domain_id = s.domain_id
            LEFT JOIN quiz_results qr
                ON qr.skill_id = s.skill_id
               AND qr.user_id = %s
            GROUP BY
                s.skill_id,
                s.skill_name,
                s.domain_id,
                d.domain_name,
                s.difficulty_level,
                s.priority
            ORDER BY d.domain_name, s.skill_name
            """,
            (user_id,)
        )

        columns = [column[0] for column in cursor.description]
        rows = [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]

        for skill in rows:
            total_questions = skill["total_questions"]
            correct = skill["total_correct"]

            skill["percentage"] = (
                round(correct * 100 / total_questions)
                if total_questions
                else 0
            )

            if skill["attempts"] == 0:
                skill["status"] = "Not Attempted"
            elif skill["percentage"] >= 75:
                skill["status"] = "Strong"
            elif skill["percentage"] >= 50:
                skill["status"] = "Intermediate"
            else:
                skill["status"] = "Needs Improvement"

            if skill["last_attempt"]:
                skill["last_attempt"] = (
                    skill["last_attempt"].isoformat()
                )

        attempted = [
            skill for skill in rows
            if skill["attempts"] > 0
        ]

        total_attempts = sum(
            skill["attempts"] for skill in rows
        )

        overall_percentage = (
            round(
                sum(skill["total_correct"] for skill in attempted)
                * 100
                / sum(skill["total_questions"] for skill in attempted)
            )
            if attempted
            and sum(skill["total_questions"] for skill in attempted) > 0
            else 0
        )

        return jsonify({
            "success": True,
            "user_id": user_id,
            "total_skills": len(rows),
            "skills_attempted": len(attempted),
            "total_attempts": total_attempts,
            "overall_percentage": overall_percentage,
            "skills": rows
        })

    except Exception:
        app.logger.exception("Fetching progress failed")
        return error_response("Unable to fetch progress.")

    finally:
        close_db(cursor, connection)


# ==========================================
# GET LEARNING RESOURCES
#
# GET /api/resources?skill_id=5
# Optional: &difficulty=Basic
# ==========================================

@app.route("/api/resources", methods=["GET"])
def get_resources():
    skill_id = request.args.get("skill_id", type=int)
    difficulty = request.args.get("difficulty", type=str)

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        query = """
            SELECT
                r.resource_id,
                r.skill_id,
                s.skill_name,
                r.resource_title,
                r.platform,
                r.resource_type,
                r.resource_url,
                r.description,
                r.difficulty_level
            FROM resources r
            LEFT JOIN skills s ON s.skill_id = r.skill_id
            WHERE 1 = 1
        """

        params = []

        if skill_id is not None:
            if skill_id <= 0:
                return error_response("Invalid skill_id.", 400)

            query += " AND r.skill_id = %s"
            params.append(skill_id)

        if difficulty:
            if difficulty.title() not in (
                "Basic", "Intermediate", "Advanced"
            ):
                return error_response(
                    "Invalid difficulty level.",
                    400
                )

            query += """
                AND (
                    r.difficulty_level IS NULL
                    OR LOWER(r.difficulty_level) = LOWER(%s)
                )
            """
            params.append(difficulty.title())

        query += " ORDER BY r.resource_title"

        cursor.execute(query, tuple(params))

        columns = [column[0] for column in cursor.description]
        resources = [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]

        return jsonify({
            "success": True,
            "count": len(resources),
            "resources": resources
        })

    except Exception:
        app.logger.exception("Fetching resources failed")
        return error_response("Unable to fetch resources.")

    finally:
        close_db(cursor, connection)


# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )