
-- Trips table
CREATE TABLE public.pft_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    command_name TEXT DEFAULT 'Family Trip Command Center',
    basecamp_location TEXT,
    basecamp_lat DOUBLE PRECISION,
    basecamp_lng DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Families table
CREATE TABLE public.pft_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.pft_trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    origin TEXT,
    short_origin TEXT,
    status TEXT,
    eta TEXT,
    drive_time TEXT,
    headcount TEXT,
    vehicle TEXT,
    responsibility TEXT,
    readiness INTEGER DEFAULT 0,
    route_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Checklists table
CREATE TABLE public.pft_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.pft_families(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    done BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Itinerary table
CREATE TABLE public.pft_itinerary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.pft_trips(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'transit', 'activities', 'support'
    label TEXT NOT NULL,
    start_val DOUBLE PRECISION,
    span_val DOUBLE PRECISION,
    color TEXT,
    family_id UUID REFERENCES public.pft_families(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Meals table
CREATE TABLE public.pft_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.pft_trips(id) ON DELETE CASCADE,
    day_name TEXT NOT NULL,
    meal_name TEXT NOT NULL,
    owner_name TEXT,
    status_text TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expenses table
CREATE TABLE public.pft_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.pft_trips(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    payer TEXT,
    amount NUMERIC(10, 2) DEFAULT 0,
    split_info TEXT,
    settled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activities table
CREATE TABLE public.pft_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.pft_trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status_text TEXT, -- 'Go', 'Watch', etc.
    window_time TEXT,
    description TEXT,
    backup_plan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pft_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pft_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pft_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pft_itinerary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pft_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pft_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pft_activities ENABLE ROW LEVEL SECURITY;

-- Shared access policy (simplified for demo/family use as requested)
-- In a real app, we'd use auth.uid(), but for "shared password", we'll rely on the app logic 
-- and maybe a simple common user in Supabase or just public access if the URL is secret enough.
-- But since it's the SAME project as rst-ai-antigravity, we'll use a policy that allows access.

-- For simplicity and following the user's "shared password" logic, 
-- we'll allow all authenticated users (who know the shared password and log in through the app) to view/edit.
CREATE POLICY "Enable all for authenticated users" ON public.pft_trips FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.pft_families FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.pft_checklists FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.pft_itinerary FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.pft_meals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.pft_expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.pft_activities FOR ALL USING (auth.role() = 'authenticated');
