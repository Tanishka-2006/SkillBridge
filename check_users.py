
from db import get_db_connection

connection = get_db_connection()
cursor = connection.cursor()

cursor.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
""")

print("Users table columns:")
for column in cursor.fetchall():
    print(column)

cursor.close()
connection.close()
