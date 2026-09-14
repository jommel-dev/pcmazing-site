# SQL migrations

Bundled schema for a **blank** PostgreSQL database.

Apply `000_initial_migration_bundle.sql` from the admin Setup page (bundled migrations) or with psql.

This file creates the current PCmazing structure in one pass. Legacy 3BMA tables that the app no longer requires (`tblusers`, `tblrbac`, `tblquotation`, and convenience views such as `systems`) are omitted. Inventory and purchases still use `tblmaterials`, `tblbrands`, `tblproducttypes`, `tblvendors`, `tblpurchase_orders`, `tbltransaction_material_items`, and `tblpo_payments`.
