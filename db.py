import os
import psycopg2

def get_db_connection():
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        return psycopg2.connect(database_url)

    connection = psycopg2.connect(
        host="localhost",
        database="skillbridge",
        user="postgres",
        password="987654321",
        port="5432"
    )

    return connection
