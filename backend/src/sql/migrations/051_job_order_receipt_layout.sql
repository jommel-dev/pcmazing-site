UPDATE pcmazing_printing_settings
SET store_name = 'PCmazing Information Technology Services',
    updated_at = NOW()
WHERE id = 1
  AND TRIM(store_name) IN ('PCmazing', 'PCmazing Information Technology Services');

UPDATE pcmazing_printing_templates
SET layout_json = $json${
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
    {"id":"jo_store_name","type":"field","fieldKey":"storeName","label":"Store name","x":10,"y":58,"width":190,"height":8,"fontSize":13,"fontWeight":"bold","textAlign":"center"},
    {"id":"jo_store_address","type":"field","fieldKey":"storeAddress","label":"Store address","x":10,"y":67,"width":190,"height":6,"fontSize":11,"textAlign":"center"},
    {"id":"jo_bill_to","type":"field","fieldKey":"billToLine","label":"Bill To / Contact","x":10,"y":78,"width":190,"height":6,"fontSize":11},
    {"id":"jo_address","type":"field","fieldKey":"addressLine","label":"Address","x":10,"y":84,"width":190,"height":8,"fontSize":11},
    {"id":"jo_line_items","type":"table","fieldKey":"lineItems","label":"Line items","x":10,"y":94,"width":190,"height":70,"fontSize":10},
    {"id":"jo_discount_total","type":"field","fieldKey":"discountTotal","label":"Total Sales Discounts","x":10,"y":168,"width":90,"height":6,"fontSize":11},
    {"id":"jo_subtotal","type":"field","fieldKey":"subtotal","label":"Subtotal","x":120,"y":168,"width":80,"height":6,"fontSize":11,"textAlign":"right"},
    {"id":"jo_receipt_total","type":"field","fieldKey":"receiptTotal","label":"RECEIPT TOTAL","x":120,"y":176,"width":80,"height":7,"fontSize":12,"fontWeight":"bold","textAlign":"right"},
    {"id":"jo_remarks","type":"field","fieldKey":"jobNotes","label":"Remarks","x":10,"y":186,"width":190,"height":16,"fontSize":11},
    {"id":"jo_warranty","type":"field","fieldKey":"warrantyPolicy","label":"Warranty policy","x":20,"y":206,"width":170,"height":36,"fontSize":10,"textAlign":"center"},
    {"id":"jo_footer_note","type":"field","fieldKey":"footerNote","label":"Footer tax note","x":10,"y":246,"width":190,"height":5,"fontSize":10,"textAlign":"center"},
    {"id":"jo_thanks","type":"field","fieldKey":"thanksMessage","label":"Thanks message","x":10,"y":252,"width":190,"height":5,"fontSize":11,"fontWeight":"bold","textAlign":"center"},
    {"id":"jo_barcode","type":"field","fieldKey":"barcode","label":"Barcode","x":70,"y":260,"width":70,"height":16,"fontSize":10,"textAlign":"center"},
    {"id":"jo_signature","type":"field","fieldKey":"signatureLine","label":"Signature","x":10,"y":280,"width":60,"height":8,"fontSize":10}
  ]
}$json$::jsonb,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND LOWER(TRIM(name)) = LOWER('Job Order Sales Receipt');
