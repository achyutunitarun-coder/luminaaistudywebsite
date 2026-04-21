-- ============ exam_packs catalog ============
CREATE TABLE public.exam_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  subject text NOT NULL,
  level text NOT NULL,
  emoji text NOT NULL DEFAULT '📚',
  price_cents integer NOT NULL DEFAULT 9900,
  original_price_cents integer NOT NULL DEFAULT 49900,
  currency text NOT NULL DEFAULT 'INR',
  whats_inside jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view exam packs"
  ON public.exam_packs FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER trg_exam_packs_updated
  BEFORE UPDATE ON public.exam_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ user_unlocked_packs ============
CREATE TABLE public.user_unlocked_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.exam_packs(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  payment_id text,
  payment_status text NOT NULL DEFAULT 'pending',
  html_storage_path text,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  generated_at timestamptz,
  UNIQUE (user_id, pack_id)
);
ALTER TABLE public.user_unlocked_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own unlocks"
  ON public.user_unlocked_packs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own unlocks"
  ON public.user_unlocked_packs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own unlocks"
  ON public.user_unlocked_packs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_unlocked_user ON public.user_unlocked_packs(user_id);

-- ============ Storage bucket for cached pack HTML ============
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-pack-html', 'exam-pack-html', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own pack html"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exam-pack-html' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own pack html"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-pack-html' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own pack html"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-pack-html' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ Seed all 50 exam packs ============
INSERT INTO public.exam_packs (product_id, title, description, subject, level, emoji, sort_order) VALUES
('pdt_0NdA9DWb8MUJOzgINlPcT','Calculus Mastery','Differentiation & Integration deep dive','MATHEMATICS','Advanced','∫',1),
('pdt_0NdA9Dcg7XjE4yM9LQNg2','Coordinate Geometry Complete','Circles, Parabolas, Ellipse','MATHEMATICS','Intermediate','📐',2),
('pdt_0NdA9Dg79lCwOJIXb3tGk','Algebra Powerpack','Quadratics, Progressions, Binomial','MATHEMATICS','Intermediate','🧮',3),
('pdt_0NdA9DjcircbXcqfhgHbr','Statistics & Probability','Data, Distributions, Bayes','MATHEMATICS','Advanced','📊',4),
('pdt_0NdA9DnF8DeVokRt2bQES','3D Geometry & Vectors','Lines, Planes, Dot & Cross Products','MATHEMATICS','Mastery','🧊',5),
('pdt_0NdA9DqlQ7szliI9T9Xz4','Trigonometry Ultimate','Identities, Equations, Heights & Distances','MATHEMATICS','Intermediate','📏',6),
('pdt_0NdA9Duv2Ld1WFBwfzfZR','JEE Mathematics Sprint','Top 200 most repeated JEE problems','MATHEMATICS','Mastery','🚀',7),
('pdt_0NdA9E0GgpfIWwINvqr3R','Electrostatics & Current','Gauss, Capacitors, Kirchhoff','PHYSICS','Advanced','⚡',8),
('pdt_0NdA9E3kkexRyMcT2Jfox','Waves & Oscillations','SHM, Standing Waves, Doppler','PHYSICS','Intermediate','🌊',9),
('pdt_0NdA9E7WCDk4bckOSLO7h','Mechanics Masterclass','Newton, Work-Energy, Rotation','PHYSICS','Advanced','🎯',10),
('pdt_0NdA9EBBd8iF6yQmLHyWw','Ray & Wave Optics','Mirrors, Lenses, Interference, Diffraction','PHYSICS','Intermediate','🔬',11),
('pdt_0NdA9EEP4Y0kSWmnTNA69','Thermodynamics Complete','Laws, Processes, Engines','PHYSICS','Advanced','🔥',12),
('pdt_0NdA9EHk4TZbqpA9pj9gr','Modern Physics','Photoelectric, Atoms, Nuclei, Semiconductors','PHYSICS','Mastery','⚛️',13),
('pdt_0NdA9ELAKUZqUcV8Gn9LC','JEE Physics Sprint','Top 200 most repeated JEE problems','PHYSICS','Mastery','🚀',14),
('pdt_0NdA9EQnNJrUyhJSRWwRG','Organic Chemistry Reactions','Named Reactions, Mechanisms','CHEMISTRY','Mastery','🧪',15),
('pdt_0NdA9EVmLdMXy3S94Qzbx','Physical Chemistry Core','Equilibrium, Kinetics, Electrochemistry','CHEMISTRY','Advanced','⚗️',16),
('pdt_0NdA9EYyGfRV9gB1SPTpI','Inorganic Chemistry','p-block, d-block, Coordination Compounds','CHEMISTRY','Advanced','🧫',17),
('pdt_0NdA9Ec5h7Bhw9zbo1CJ8','Biomolecules & Polymers','Carbs, Proteins, DNA','CHEMISTRY','Intermediate','🧬',18),
('pdt_0NdA9EfGs4egxjURfWJoe','Thermochemistry & Solutions','Hess, Colligative, Phase','CHEMISTRY','Intermediate','🌡️',19),
('pdt_0NdA9EiY50JTHi280HABu','JEE Chemistry Sprint','Top 200 most repeated JEE problems','CHEMISTRY','Mastery','🚀',20),
('pdt_0NdA9ElfTuCxhOjWw9sbf','Genetics & Evolution','Mendel, DNA, Mutation, Darwin','BIOLOGY','Advanced','🧬',21),
('pdt_0NdA9EopAwyco4w7QBnRX','Plant Physiology','Photosynthesis, Respiration, Hormones','BIOLOGY','Intermediate','🌱',22),
('pdt_0NdA9Es1pwTziIxQ1FvT1','Human Physiology','Digestion, Circulation, Nerves, Excretion','BIOLOGY','Advanced','🫀',23),
('pdt_0NdA9EvDmGidR2igbFWdi','Microbes & Biotechnology','Genetic Engineering, Cloning','BIOLOGY','Mastery','🦠',24),
('pdt_0NdA9EyKQT3N23MfHFXdW','Ecology & Environment','Ecosystems, Biodiversity, Pollution','BIOLOGY','Intermediate','🌍',25),
('pdt_0NdA9F1ZN8BP7M1ivBqST','NEET Biology Sprint','Top 200 most repeated NEET questions','BIOLOGY','Mastery','🚀',26),
('pdt_0NdA9F4iGwgRg9SfAcXCP','Ancient India Complete','Indus Valley to Gupta Empire','HISTORY','Intermediate','🏛️',27),
('pdt_0NdA9F7nPgZQWwWBeYl7i','Medieval India Masterclass','Delhi Sultanate to Mughal Empire','HISTORY','Intermediate','🕌',28),
('pdt_0NdA9FAxr44xBv7bpZ8r4','Modern India','British Rule, Freedom Movement, Partition','HISTORY','Advanced','🇮🇳',29),
('pdt_0NdA9FE0hQ57CCVbPSupz','World History Sprint','Revolutions, World Wars, Cold War','HISTORY','Advanced','🌐',30),
('pdt_0NdA9FH5pP59D15C0gWxH','IAS History Powerpack','Most repeated UPSC questions','HISTORY','Mastery','📜',31),
('pdt_0NdA9FKzcdOBAnJV4jIxA','Physical Geography Core','Landforms, Climate, Soils, Rivers','GEOGRAPHY','Intermediate','🏔️',32),
('pdt_0NdA9FPuo9AVFxtXU4sDR','Human Geography','Population, Migration, Settlement','GEOGRAPHY','Intermediate','👥',33),
('pdt_0NdA9FT5zzvSvtbiPHyMZ','Indian Geography Complete','Relief, Resources, Agriculture','GEOGRAPHY','Advanced','🗺️',34),
('pdt_0NdA9FWHuEPuoPXqpxI43','Climatology & Disasters','El Niño, Cyclones, Earthquakes','GEOGRAPHY','Advanced','🌪️',35),
('pdt_0NdA9FZQqjUTdZGCLbL8r','IAS Geography Powerpack','Most repeated UPSC questions','GEOGRAPHY','Mastery','🌏',36),
('pdt_0NdA9Fd0v2dH4ZPICU6Ud','Microeconomics Deep Dive','Demand, Supply, Elasticity, Market Structures','ECONOMICS','Intermediate','📈',37),
('pdt_0NdA9Fg7ZmL5jHFi2rWbo','Macroeconomics Complete','GDP, Inflation, Monetary Policy, Fiscal','ECONOMICS','Advanced','💹',38),
('pdt_0NdA9FjDSKRVqUWg70Klq','Indian Economy Masterclass','Sectors, Planning, Reforms, Budget','ECONOMICS','Advanced','🇮🇳',39),
('pdt_0NdA9FmJN4VBkQuMsOue7','International Trade & Finance','WTO, Balance of Payments, IMF','ECONOMICS','Advanced','🌐',40),
('pdt_0NdA9FpOUAzzMhC2gHw06','IAS Economics Sprint','Most repeated UPSC economics questions','ECONOMICS','Mastery','💰',41),
('pdt_0NdA9FscgrGZNZ4sJwId9','Prose & Unseen Passages','Comprehension, Summary, Analysis','ENGLISH LITERATURE','Foundation','📖',42),
('pdt_0NdA9Fvk6qbxwVMtC5b6V','Essay Writing Mastery','Structure, Styles, 50 Model Essays','ENGLISH LITERATURE','Intermediate','✍️',43),
('pdt_0NdA9Fyt0EkLSIs8StWdG','Poetry Analysis Complete','Figures of Speech, Themes, Annotations','ENGLISH LITERATURE','Intermediate','🎭',44),
('pdt_0NdA9G25gJcHG2Jw8kUB4','Grammar & Language Use','Tenses, Voice, Reported Speech, Error Correction','ENGLISH LITERATURE','Foundation','📝',45),
('pdt_0NdA9G5D6E0H9Hj9kmwSN','Python Programming Sprint','Syntax, OOP, Data Structures, Algorithms','COMPUTER SCIENCE','Intermediate','🐍',46),
('pdt_0NdA9GAsP3LOM7HUi9G2V','Database & SQL Mastery','Queries, Normalization, Transactions','COMPUTER SCIENCE','Intermediate','🗄️',47),
('pdt_0NdA9GE4KvJA5Ys3uQkoQ','Computer Networks Complete','OSI, TCP/IP, Protocols, Security','COMPUTER SCIENCE','Advanced','🌐',48),
('pdt_0NdA9GHIVtGI4dI3ITVqK','Data Structures & Algorithms','Arrays, Trees, Graphs, Sorting, DP','COMPUTER SCIENCE','Mastery','💻',49),
('pdt_0NdA9GLBX8QNWWmnJqnwR','General Studies Megapack','Polity, Economy, Science, Current Affairs','CROSSOVER / COMPETITIVE','Mastery','🏆',50);

-- Default whats_inside bullets
UPDATE public.exam_packs SET whats_inside = jsonb_build_array(
  '25 high-yield MCQs with full solutions',
  '10 short answers + 5 long answers',
  'Examiner''s secrets & common mistakes',
  '10-point last-minute revision checklist'
) WHERE whats_inside = '[]'::jsonb;