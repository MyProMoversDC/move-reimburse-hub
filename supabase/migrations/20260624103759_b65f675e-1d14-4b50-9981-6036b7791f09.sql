
-- UOM enum
DO $$ BEGIN
  CREATE TYPE public.unit_of_measure AS ENUM ('piece', 'roll', 'box', 'pack', 'set', 'ft', 'lb');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INVENTORY CATEGORIES
CREATE TABLE public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_categories TO authenticated;
GRANT ALL ON public.inventory_categories TO service_role;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_cat_read" ON public.inventory_categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "inv_cat_write" ON public.inventory_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));

-- INVENTORY ITEMS
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  uom public.unit_of_measure NOT NULL DEFAULT 'piece',
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_items_read" ON public.inventory_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "inv_items_write" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRUCKS
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number TEXT NOT NULL UNIQUE,
  license_plate TEXT,
  capacity_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trucks TO authenticated;
GRANT ALL ON public.trucks TO service_role;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trucks_read" ON public.trucks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager') OR public.has_role(auth.uid(),'mover'));
CREATE POLICY "trucks_write" ON public.trucks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE TRIGGER trg_trucks_updated_at BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRUCK INVENTORY
CREATE TABLE public.truck_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(truck_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.truck_inventory TO authenticated;
GRANT ALL ON public.truck_inventory TO service_role;
ALTER TABLE public.truck_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "truck_inv_read" ON public.truck_inventory FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "truck_inv_write" ON public.truck_inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));

-- JOB TYPES
CREATE TABLE public.job_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_types TO authenticated;
GRANT ALL ON public.job_types TO service_role;
ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_types_read" ON public.job_types FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "job_types_write" ON public.job_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));

CREATE TABLE public.job_type_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type_id UUID NOT NULL REFERENCES public.job_types(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE(job_type_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_type_requirements TO authenticated;
GRANT ALL ON public.job_type_requirements TO service_role;
ALTER TABLE public.job_type_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_type_req_read" ON public.job_type_requirements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "job_type_req_write" ON public.job_type_requirements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));

-- INV JOB ORDERS
CREATE TABLE public.inv_job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  job_type_id UUID REFERENCES public.job_types(id),
  truck_id UUID REFERENCES public.trucks(id),
  job_date DATE NOT NULL,
  pickup_address TEXT,
  dropoff_address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  smartmoving_id TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_job_orders TO authenticated;
GRANT ALL ON public.inv_job_orders TO service_role;
ALTER TABLE public.inv_job_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_jo_read" ON public.inv_job_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "inv_jo_write" ON public.inv_job_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));
CREATE TRIGGER trg_inv_jo_updated_at BEFORE UPDATE ON public.inv_job_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PURCHASES
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2),
  vendor TEXT,
  notes TEXT,
  purchased_by UUID NOT NULL REFERENCES auth.users(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_read" ON public.purchases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager') OR public.has_role(auth.uid(),'accountant'));
CREATE POLICY "purchases_write" ON public.purchases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));

-- DAILY LOCKS
CREATE TABLE public.daily_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_date DATE NOT NULL UNIQUE,
  locked_by UUID NOT NULL REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlocked_by UUID REFERENCES auth.users(id),
  unlocked_at TIMESTAMPTZ,
  unlock_reason TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_locks TO authenticated;
GRANT ALL ON public.daily_locks TO service_role;
ALTER TABLE public.daily_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_locks_read" ON public.daily_locks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "daily_locks_write" ON public.daily_locks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));

-- INV AUDIT LOGS
CREATE TABLE public.inv_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  quantity_before INTEGER,
  quantity_after INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inv_audit_logs TO authenticated;
GRANT ALL ON public.inv_audit_logs TO service_role;
ALTER TABLE public.inv_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_audit_read" ON public.inv_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));
CREATE POLICY "inv_audit_insert" ON public.inv_audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- WAREHOUSE ZONES
CREATE TABLE public.warehouse_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  zone_type TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  x_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  y_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  width_pct NUMERIC(6,3) NOT NULL DEFAULT 10,
  height_pct NUMERIC(6,3) NOT NULL DEFAULT 10,
  color TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_zones TO authenticated;
GRANT ALL ON public.warehouse_zones TO service_role;
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_zones_read" ON public.warehouse_zones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "wh_zones_write" ON public.warehouse_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));
CREATE TRIGGER trg_wh_zones_updated_at BEFORE UPDATE ON public.warehouse_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.warehouse_zone_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.warehouse_zones(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  label TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_zone_items TO authenticated;
GRANT ALL ON public.warehouse_zone_items TO service_role;
ALTER TABLE public.warehouse_zone_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_zone_items_read" ON public.warehouse_zone_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "wh_zone_items_write" ON public.warehouse_zone_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper'));

-- CREWS
CREATE TABLE public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crew_date DATE NOT NULL,
  lead_user_id UUID REFERENCES public.profiles(id),
  truck_id UUID REFERENCES public.trucks(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crews TO authenticated;
GRANT ALL ON public.crews TO service_role;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crews_read" ON public.crews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager') OR public.has_role(auth.uid(),'mover'));
CREATE POLICY "crews_write" ON public.crews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));
CREATE TRIGGER trg_crews_updated_at BEFORE UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crew_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_members TO authenticated;
GRANT ALL ON public.crew_members TO service_role;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_mem_read" ON public.crew_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager') OR auth.uid() = user_id);
CREATE POLICY "crew_mem_write" ON public.crew_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));

CREATE TABLE public.crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  inv_job_order_id UUID NOT NULL REFERENCES public.inv_job_orders(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(crew_id, inv_job_order_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_assignments TO authenticated;
GRANT ALL ON public.crew_assignments TO service_role;
ALTER TABLE public.crew_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_asg_read" ON public.crew_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager') OR public.has_role(auth.uid(),'mover'));
CREATE POLICY "crew_asg_write" ON public.crew_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));

-- PLANNING
CREATE TABLE public.planning_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date DATE NOT NULL,
  name TEXT,
  truck_id UUID REFERENCES public.trucks(id),
  crew_id UUID REFERENCES public.crews(id),
  optimized_payload JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_routes TO authenticated;
GRANT ALL ON public.planning_routes TO service_role;
ALTER TABLE public.planning_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning_routes_read" ON public.planning_routes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "planning_routes_write" ON public.planning_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));
CREATE TRIGGER trg_planning_routes_updated_at BEFORE UPDATE ON public.planning_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.planning_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.planning_routes(id) ON DELETE CASCADE,
  inv_job_order_id UUID REFERENCES public.inv_job_orders(id) ON DELETE SET NULL,
  stop_order INTEGER NOT NULL DEFAULT 0,
  address TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  scheduled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_stops TO authenticated;
GRANT ALL ON public.planning_stops TO service_role;
ALTER TABLE public.planning_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning_stops_read" ON public.planning_stops FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager'));
CREATE POLICY "planning_stops_write" ON public.planning_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));

-- MOVER LOCATION PINGS
CREATE TABLE public.mover_location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inv_job_order_id UUID REFERENCES public.inv_job_orders(id) ON DELETE SET NULL,
  crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL,
  lat NUMERIC(10,6) NOT NULL,
  lng NUMERIC(10,6) NOT NULL,
  accuracy_m NUMERIC(8,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mover_loc_pings_user_recent ON public.mover_location_pings (user_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.mover_location_pings TO authenticated;
GRANT ALL ON public.mover_location_pings TO service_role;
ALTER TABLE public.mover_location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mover_loc_pings_read" ON public.mover_location_pings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse_keeper') OR public.has_role(auth.uid(),'operations_manager') OR auth.uid() = user_id);
CREATE POLICY "mover_loc_pings_insert_self" ON public.mover_location_pings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
