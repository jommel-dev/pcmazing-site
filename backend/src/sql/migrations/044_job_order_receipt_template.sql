-- Seed the current Job Order sales receipt layout as a default printable template.
INSERT INTO pcmazing_printing_templates (
  name,
  document_type,
  paper_width_mm,
  paper_height_mm,
  layout_json,
  is_default,
  is_active
)
SELECT
  'Job Order Sales Receipt',
  'sales_receipt',
  210,
  297,
  $json${
    "elements": [
      {"id":"jo_printed_at","type":"field","fieldKey":"printedAt","label":"Printed","x":10,"y":8,"width":90,"height":5,"fontSize":10,"textAlign":"left"},
      {"id":"jo_store_code","type":"field","fieldKey":"storeCode","label":"Store","x":10,"y":13,"width":90,"height":5,"fontSize":10},
      {"id":"jo_workstation","type":"field","fieldKey":"workstationNo","label":"Workstation","x":10,"y":18,"width":90,"height":5,"fontSize":10},
      {"id":"jo_receipt_no","type":"field","fieldKey":"receiptNo","label":"Sales Receipt #","x":110,"y":8,"width":90,"height":5,"fontSize":11,"fontWeight":"bold","textAlign":"right"},
      {"id":"jo_printed_date","type":"field","fieldKey":"printedDate","label":"Date","x":110,"y":13,"width":90,"height":5,"fontSize":10,"textAlign":"right"},
      {"id":"jo_cashier","type":"field","fieldKey":"cashierName","label":"Cashier","x":110,"y":18,"width":90,"height":5,"fontSize":10,"textAlign":"right"},
      {"id":"jo_page","type":"field","fieldKey":"pageNumber","label":"Page","x":110,"y":23,"width":90,"height":5,"fontSize":10,"textAlign":"right"},
      {"id":"jo_reprinted","type":"field","fieldKey":"reprintedLabel","label":"Reprinted","x":10,"y":32,"width":190,"height":5,"fontSize":10,"fontWeight":"bold","textAlign":"center"},
      {"id":"jo_logo","type":"image","fieldKey":"storeLogo","label":"Store logo","x":85,"y":38,"width":40,"height":18},
      {"id":"jo_store_name","type":"field","fieldKey":"storeName","label":"Store name","x":10,"y":58,"width":190,"height":6,"fontSize":14,"fontWeight":"bold","textAlign":"center"},
      {"id":"jo_store_address","type":"field","fieldKey":"storeAddress","label":"Store address","x":10,"y":65,"width":190,"height":6,"fontSize":11,"textAlign":"center"},
      {"id":"jo_bill_to_label","type":"text","label":"Bill To label","content":"Bill To:","x":10,"y":78,"width":40,"height":5,"fontSize":11,"fontWeight":"bold"},
      {"id":"jo_customer","type":"field","fieldKey":"customerName","label":"Customer name","x":10,"y":84,"width":190,"height":6,"fontSize":12,"fontWeight":"bold"},
      {"id":"jo_line_items","type":"table","fieldKey":"lineItems","label":"Line items","x":10,"y":94,"width":190,"height":70,"fontSize":10},
      {"id":"jo_discount_total","type":"field","fieldKey":"discountTotal","label":"Total Sales Discounts","x":10,"y":168,"width":90,"height":6,"fontSize":11},
      {"id":"jo_subtotal","type":"field","fieldKey":"subtotal","label":"Subtotal","x":120,"y":168,"width":80,"height":6,"fontSize":11,"textAlign":"right"},
      {"id":"jo_receipt_total","type":"field","fieldKey":"receiptTotal","label":"RECEIPT TOTAL","x":120,"y":176,"width":80,"height":7,"fontSize":12,"fontWeight":"bold","textAlign":"right"},
      {"id":"jo_warranty","type":"field","fieldKey":"warrantyPolicy","label":"Warranty policy","x":20,"y":190,"width":170,"height":42,"fontSize":10,"textAlign":"center"},
      {"id":"jo_footer_note","type":"field","fieldKey":"footerNote","label":"Footer tax note","x":10,"y":236,"width":190,"height":5,"fontSize":10,"textAlign":"center"},
      {"id":"jo_thanks","type":"field","fieldKey":"thanksMessage","label":"Thanks message","x":10,"y":242,"width":190,"height":5,"fontSize":11,"fontWeight":"bold","textAlign":"center"},
      {"id":"jo_barcode","type":"field","fieldKey":"barcode","label":"Barcode","x":70,"y":252,"width":70,"height":16,"fontSize":10,"textAlign":"center"},
      {"id":"jo_signature","type":"field","fieldKey":"signatureLine","label":"Signature","x":10,"y":274,"width":60,"height":8,"fontSize":10}
    ]
  }$json$::jsonb,
  TRUE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM pcmazing_printing_templates
  WHERE deleted_at IS NULL
    AND LOWER(TRIM(name)) = LOWER('Job Order Sales Receipt')
);

UPDATE pcmazing_printing_settings s
SET default_template_id = t.id,
    updated_at = NOW()
FROM pcmazing_printing_templates t
WHERE s.id = 1
  AND s.default_template_id IS NULL
  AND t.deleted_at IS NULL
  AND LOWER(TRIM(t.name)) = LOWER('Job Order Sales Receipt');
