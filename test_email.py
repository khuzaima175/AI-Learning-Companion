import os
import sys
from dotenv import load_dotenv

# Load the environment variables from .env
load_dotenv()

# Import the morning email function
from src.email_service import send_morning_email

if __name__ == "__main__":
    email = os.environ.get("NOTIFY_EMAIL")
    print(f"Attempting to send test email to: {email}...")
    
    # We pass '10' so the email says "10 cards due" as a test
    success = send_morning_email(email, 10)
    
    if success:
        print("SUCCESS! Check your inbox.")
    else:
        print("FAILED to send. Check the console error above.")
