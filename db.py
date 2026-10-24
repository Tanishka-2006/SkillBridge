import psycopg2

def get_db_connection():
    connection = psycopg2.connect(
        host="localhost",
        database="skillbridge",
        user="postgres",
        password="987654321",
        port="5432"
    )
    return connection