## Plan

1. **Fix both PDF download crashes**
   - Update the report PDF generator and cybercrime complaint PDF generator so every string is sanitized before width measurement and before drawing.
   - Replace unsupported characters like the Unicode minus sign `−`, multiplication sign `×`, arrows, bullets, smart quotes, rupee symbols, and other non-Helvetica glyphs with safe PDF text.
   - This should stop the `WinAnsi cannot encode` error shown in your screenshot for both “Download PDF” and the cybercrime complaint PDF.

2. **Fix the Home button behavior for signed-in users**
   - The current first home route redirects signed-in users to `/dashboard`, so clicking Home from the dashboard cannot show the first landing page.
   - Change the home route so signed-in users can also view the same first home page UI as guests.
   - Keep Dashboard/History available separately for saved investigations.

3. **Fix “Save to history” asking for login while already logged in**
   - Make the save/download auth check use the stronger current-user check instead of only reading the cached session.
   - If a user is signed in but the local UI state is stale, refresh the auth state instead of opening the sign-in dialog.
   - Improve the save error handling so real backend/auth errors show clearly instead of behaving like “please login again”.

4. **Verify the complete important workflow**
   - Run the app flow after implementation: signed-in and guest home page, Home button navigation, investigation result, Save to history, Dashboard history, report PDF download, and cybercrime PDF download.
   - Confirm the WinAnsi error no longer appears and the Home button reaches the first home page.