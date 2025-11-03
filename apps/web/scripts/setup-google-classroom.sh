#!/bin/bash

# Google Classroom API Setup Script
# This script automates GCP project setup from the command line
#
# Prerequisites:
#   - gcloud CLI installed (brew install google-cloud-sdk)
#   - Valid Google account
#
# Usage:
#   ./scripts/setup-google-classroom.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Google Classroom API Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
PROJECT_ID="soroban-abacus-$(date +%s)"  # Unique project ID with timestamp
PROJECT_NAME="Soroban Abacus Flashcards"
BILLING_ACCOUNT=""  # Will prompt user if needed
REDIRECT_URIS="http://localhost:3000/api/auth/callback/google,https://abaci.one/api/auth/callback/google"

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
echo ""

# Step 1: Check if gcloud is installed
echo -e "${BLUE}[1/9] Checking gcloud installation...${NC}"
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found${NC}"
    echo "Install it with: brew install google-cloud-sdk"
    exit 1
fi
echo -e "${GREEN}✓ gcloud CLI found${NC}"
echo ""

# Step 2: Authenticate with Google
echo -e "${BLUE}[2/9] Authenticating with Google...${NC}"
CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || echo "")
if [ -z "$CURRENT_ACCOUNT" ]; then
    echo "No active account found. Opening browser to authenticate..."
    gcloud auth login
    CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
fi
echo -e "${GREEN}✓ Authenticated as: $CURRENT_ACCOUNT${NC}"
echo ""

# Step 3: Create GCP project
echo -e "${BLUE}[3/9] Creating GCP project...${NC}"
echo "Creating project: $PROJECT_ID"
gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME" 2>/dev/null || {
    echo -e "${YELLOW}Project might already exist, continuing...${NC}"
}
gcloud config set project "$PROJECT_ID"
echo -e "${GREEN}✓ Project created/selected: $PROJECT_ID${NC}"
echo ""

# Step 4: Check billing (required for APIs)
echo -e "${BLUE}[4/9] Checking billing account...${NC}"
echo -e "${YELLOW}Note: Google Classroom API requires a billing account, but it's FREE for educational use.${NC}"
echo -e "${YELLOW}You won't be charged unless you explicitly enable paid services.${NC}"
echo ""

# List available billing accounts
BILLING_ACCOUNTS=$(gcloud billing accounts list --format="value(name)" 2>/dev/null || echo "")
if [ -z "$BILLING_ACCOUNTS" ]; then
    echo -e "${YELLOW}No billing accounts found.${NC}"
    echo -e "${YELLOW}You'll need to create one at: https://console.cloud.google.com/billing${NC}"
    echo -e "${YELLOW}Press Enter after creating a billing account, or Ctrl+C to exit${NC}"
    read -r
    BILLING_ACCOUNTS=$(gcloud billing accounts list --format="value(name)")
fi

# If multiple accounts, let user choose
BILLING_COUNT=$(echo "$BILLING_ACCOUNTS" | wc -l | tr -d ' ')
if [ "$BILLING_COUNT" -eq 1 ]; then
    BILLING_ACCOUNT="$BILLING_ACCOUNTS"
else
    echo "Available billing accounts:"
    gcloud billing accounts list
    echo ""
    echo -n "Enter billing account ID (e.g., 012345-ABCDEF-678901): "
    read -r BILLING_ACCOUNT
fi

# Link billing account to project
echo "Linking billing account to project..."
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
echo -e "${GREEN}✓ Billing account linked${NC}"
echo ""

# Step 5: Enable required APIs
echo -e "${BLUE}[5/9] Enabling required APIs...${NC}"
echo "This may take 1-2 minutes..."
gcloud services enable classroom.googleapis.com --project="$PROJECT_ID"
gcloud services enable people.googleapis.com --project="$PROJECT_ID"
echo -e "${GREEN}✓ APIs enabled:${NC}"
echo "  - Google Classroom API"
echo "  - Google People API (for profile info)"
echo ""

# Step 6: Create OAuth 2.0 credentials
echo -e "${BLUE}[6/9] Creating OAuth 2.0 credentials...${NC}"

# First check if credentials already exist
EXISTING_CREDS=$(gcloud auth application-default print-access-token &>/dev/null && \
    curl -s -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
    "https://oauth2.googleapis.com/v1/projects/${PROJECT_ID}/oauthClients" 2>/dev/null | \
    grep -c "clientId" || echo "0")

if [ "$EXISTING_CREDS" -gt 0 ]; then
    echo -e "${YELLOW}OAuth credentials already exist for this project${NC}"
    echo "Skipping credential creation..."
else
    # Create OAuth client
    # Note: This creates a "Web application" type OAuth client
    echo "Creating OAuth 2.0 client..."

    # Unfortunately, gcloud doesn't have a direct command for this
    # We need to use the REST API
    echo -e "${YELLOW}Note: OAuth client creation requires using the web console${NC}"
    echo -e "${YELLOW}Opening the OAuth credentials page...${NC}"
    echo ""
    echo -e "${BLUE}Please follow these steps in the browser:${NC}"
    echo "1. Click 'Create Credentials' → 'OAuth client ID'"
    echo "2. Application type: 'Web application'"
    echo "3. Name: 'Soroban Abacus Web'"
    echo "4. Authorized JavaScript origins:"
    echo "   - http://localhost:3000"
    echo "   - https://abaci.one"
    echo "5. Authorized redirect URIs:"
    echo "   - http://localhost:3000/api/auth/callback/google"
    echo "   - https://abaci.one/api/auth/callback/google"
    echo "6. Click 'Create'"
    echo "7. Copy the Client ID and Client Secret"
    echo ""

    # Open browser to credentials page
    open "https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID" 2>/dev/null || \
    echo "Open this URL: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"

    echo -n "Press Enter after creating the OAuth client..."
    read -r
fi

echo -e "${GREEN}✓ OAuth credentials configured${NC}"
echo ""

# Step 7: Configure OAuth Consent Screen
echo -e "${BLUE}[7/9] Configuring OAuth consent screen...${NC}"
echo -e "${YELLOW}The OAuth consent screen requires web console configuration${NC}"
echo ""
echo -e "${BLUE}Please follow these steps:${NC}"
echo "1. User Type: 'External' (unless you have Google Workspace)"
echo "2. App name: 'Soroban Abacus Flashcards'"
echo "3. User support email: Your email"
echo "4. Developer contact: Your email"
echo "5. Scopes: Click 'Add or Remove Scopes' and add:"
echo "   - .../auth/userinfo.email"
echo "   - .../auth/userinfo.profile"
echo "   - .../auth/classroom.courses.readonly"
echo "   - .../auth/classroom.rosters.readonly"
echo "6. Test users: Add your email for testing"
echo "7. Save and continue"
echo ""

# Open OAuth consent screen configuration
open "https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID" 2>/dev/null || \
echo "Open this URL: https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"

echo -n "Press Enter after configuring the consent screen..."
read -r

echo -e "${GREEN}✓ OAuth consent screen configured${NC}"
echo ""

# Step 8: Create .env.local file
echo -e "${BLUE}[8/9] Creating environment configuration...${NC}"
echo ""
echo "Please enter your OAuth credentials from the previous step:"
echo -n "Client ID: "
read -r CLIENT_ID
echo -n "Client Secret: "
read -r -s CLIENT_SECRET
echo ""

# Create or update .env.local
ENV_FILE=".env.local"
if [ -f "$ENV_FILE" ]; then
    echo "Backing up existing $ENV_FILE to ${ENV_FILE}.backup"
    cp "$ENV_FILE" "${ENV_FILE}.backup"
fi

# Add Google OAuth credentials
echo "" >> "$ENV_FILE"
echo "# Google OAuth (Generated by setup-google-classroom.sh)" >> "$ENV_FILE"
echo "GOOGLE_CLIENT_ID=\"$CLIENT_ID\"" >> "$ENV_FILE"
echo "GOOGLE_CLIENT_SECRET=\"$CLIENT_SECRET\"" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

echo -e "${GREEN}✓ Environment variables added to $ENV_FILE${NC}"
echo ""

# Step 9: Summary
echo -e "${BLUE}[9/9] Setup Complete!${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Project ID:      ${BLUE}$PROJECT_ID${NC}"
echo -e "Project Name:    ${BLUE}$PROJECT_NAME${NC}"
echo -e "Billing Account: ${BLUE}$BILLING_ACCOUNT${NC}"
echo -e "APIs Enabled:    ${BLUE}Classroom, People${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add Google provider to NextAuth configuration"
echo "2. Test login with 'Sign in with Google'"
echo "3. Verify Classroom API access"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View project:    gcloud projects describe $PROJECT_ID"
echo "  List APIs:       gcloud services list --enabled --project=$PROJECT_ID"
echo "  View quota:      gcloud quotas describe classroom.googleapis.com --project=$PROJECT_ID"
echo ""
echo -e "${GREEN}Setup script complete!${NC}"
