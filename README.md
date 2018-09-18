Vendor Invoice Management
=========================

Installation
------------

These are prerequisites to install new instances of the app:

1. Create new Google Spreadsheet
    * create Invoices and Contractors sheets (names are hardcoded but
      can be changed in code, see `main.js` `SETTINGS` variable
    * both sheets must have specific columns in specific order
    * template is (this
      spreadhsheet](https://docs.google.com/spreadsheets/d/1tP1k7lYBJZhBvF9hf4nO6I-gcS18Z3wfCVUMQ5nK3-8/edit?usp=sharing)
2. Create empty Google Apps Script and push the code to it (via `clasp`
   or copy manually)
3. Create new (or use existing) Google Cloud Project and within it
   create OAuth 2.0 client ID
   * under Authorized JavaScript origins add the domain from which
     iframe subdomain from `.googleusercontent.com` domain
4. Publish web app
5. `client/index.html` must be edited in a way that `google-signin-client_id` points to create Cloud project
6. both apps have `main.js` file which needs to be modified:

In `client/main.js` there are:

* folderSubmittedInvoices is folder ID
* spreadsheet is google spreadhsheet ID

In `sheet-app/main.js` there are:

* folders.bankExports
* folders.invoiceExports

Folders must be created manually.

Development
-----------

Use [clasp](https://developers.google.com/apps-script/guides/clasp) by
installing it with:

    npm install @google/clasp -g
