-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text DEFAULT 'real_estate',
  plan text DEFAULT 'free', -- free | pro | starter | growth | enterprise
  plan_status text DEFAULT 'active', -- active | past_due | cancelled
  paystack_customer_code text,
  paystack_subscription_code text,
  logo_url text,
  website_url text,
  created_at timestamptz DEFAULT now()
);

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  role text, -- owner | manager | trainer | salesperson | admin | super_admin
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  avatar_url text,
  is_active boolean DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Table: invites
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  token uuid DEFAULT gen_random_uuid() UNIQUE,
  status text DEFAULT 'pending', -- pending | accepted | expired
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Companies Policies
CREATE POLICY "Allow users to read their own company" ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = companies.id
    )
  );

CREATE POLICY "Allow owners to update their own company" ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = companies.id AND profiles.role IN ('owner', 'admin')
    )
  );

-- Profiles Policies
CREATE POLICY "Allow users to read profiles in their company" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id OR
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Allow users to update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Allow insert of profile during registration/invite" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Invites Policies
CREATE POLICY "Allow anonymous read of invites by token" ON public.invites
  FOR SELECT
  USING (true);

CREATE POLICY "Allow company owners/managers to manage invites" ON public.invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = invites.company_id AND profiles.role IN ('owner', 'manager', 'admin')
    )
  );

-- Table: knowledge_documents
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name text,
  file_type text, -- pdf | docx | pptx | image | url | text | script
  storage_path text,
  status text DEFAULT 'pending', -- pending | processing | ready | failed
  extracted_text text,
  word_count integer,
  created_at timestamptz DEFAULT now()
);

-- Table: company_brain
CREATE TABLE IF NOT EXISTS public.company_brain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  category text, -- products | pricing | objections | personas | competitors | policies | scripts | faq | usps
  content text NOT NULL,
  source_doc_id uuid REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Table: objection_library
CREATE TABLE IF NOT EXISTS public.objection_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  objection text NOT NULL,
  category text,
  difficulty text DEFAULT 'beginner', -- beginner | intermediate | advanced
  is_custom boolean DEFAULT false, -- false = platform default, true = company added
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_objection_per_company UNIQUE (objection, company_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objection_library ENABLE ROW LEVEL SECURITY;

-- Knowledge Documents Policies
CREATE POLICY "Allow users to read knowledge documents in their company" ON public.knowledge_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = knowledge_documents.company_id
    )
  );

CREATE POLICY "Allow company owners/managers to manage knowledge documents" ON public.knowledge_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = knowledge_documents.company_id AND profiles.role IN ('owner', 'manager', 'admin')
    )
  );

-- Company Brain Policies
CREATE POLICY "Allow users to read company brain in their company" ON public.company_brain
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = company_brain.company_id
    )
  );

CREATE POLICY "Allow company owners/managers to manage company brain" ON public.company_brain
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = company_brain.company_id AND profiles.role IN ('owner', 'manager', 'admin')
    )
  );

-- Objection Library Policies
CREATE POLICY "Allow users to read objections" ON public.objection_library
  FOR SELECT
  USING (
    company_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = objection_library.company_id
    )
  );

CREATE POLICY "Allow company owners/managers to manage objections" ON public.objection_library
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.company_id = objection_library.company_id AND profiles.role IN ('owner', 'manager', 'admin')
    )
  );

-- Seed 25 default real estate objections
INSERT INTO public.objection_library (objection, category, difficulty, is_custom, company_id) VALUES
('It''s too expensive', 'pricing', 'beginner', false, null),
('I need to speak with my spouse first', 'decision_maker', 'beginner', false, null),
('I''m comparing with other estates', 'competitor', 'intermediate', false, null),
('I don''t trust off-plan properties', 'trust', 'intermediate', false, null),
('I''m not ready to buy yet', 'timeline', 'beginner', false, null),
('Can you reduce the price?', 'pricing', 'beginner', false, null),
('I heard there are issues with the developer', 'trust', 'advanced', false, null),
('I''ll think about it and get back to you', 'timeline', 'beginner', false, null),
('I can get something cheaper elsewhere', 'pricing', 'intermediate', false, null),
('The location doesn''t work for me', 'location', 'intermediate', false, null),
('I don''t have the full payment now', 'pricing', 'beginner', false, null),
('What if the project is delayed?', 'trust', 'intermediate', false, null),
('I''m waiting for the economy to improve', 'market', 'intermediate', false, null),
('I need to see the property physically first', 'inspection', 'beginner', false, null),
('Your payment plan doesn''t work for me', 'pricing', 'intermediate', false, null),
('I need a bigger discount', 'pricing', 'beginner', false, null),
('I''m just looking for now', 'timeline', 'beginner', false, null),
('Send me more information first', 'timeline', 'beginner', false, null),
('I''ve had bad experiences with developers before', 'trust', 'advanced', false, null),
('My financial advisor said to wait', 'decision_maker', 'advanced', false, null),
('Is the government approval in place?', 'legal', 'advanced', false, null),
('What''s the resale value like?', 'investment', 'intermediate', false, null),
('Are there hidden charges?', 'pricing', 'intermediate', false, null),
('I want to see the deed of assignment first', 'legal', 'advanced', false, null),
('How long has your company been operating?', 'trust', 'beginner', false, null)
ON CONFLICT (objection, company_id) DO NOTHING;

-- Table: user_progress
CREATE TABLE IF NOT EXISTS public.user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  xp_total integer DEFAULT 0,
  level integer DEFAULT 1,
  level_title text DEFAULT 'Rookie',
  streak_days integer DEFAULT 0,
  last_active_date date,
  knowledge_score integer DEFAULT 0,
  confidence_score integer DEFAULT 0,
  conversion_score integer DEFAULT 0,
  objection_score integer DEFAULT 0,
  closing_score integer DEFAULT 0,
  simulations_completed integer DEFAULT 0,
  quizzes_completed integer DEFAULT 0,
  objections_drilled integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- User Progress Policies
CREATE POLICY "Allow users to read their own progress" ON public.user_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own progress" ON public.user_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own progress" ON public.user_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

