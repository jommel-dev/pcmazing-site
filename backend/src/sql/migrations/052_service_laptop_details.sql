ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS device_brand VARCHAR(120),
  ADD COLUMN IF NOT EXISTS device_model VARCHAR(180),
  ADD COLUMN IF NOT EXISTS device_serial VARCHAR(120);

COMMENT ON COLUMN pcmazing_services.device_brand IS
  'Laptop or device brand for identifying the customer unit.';

COMMENT ON COLUMN pcmazing_services.device_model IS
  'Laptop or device model for identifying the customer unit.';

COMMENT ON COLUMN pcmazing_services.device_serial IS
  'Laptop or device serial / service tag for identifying the customer unit.';
