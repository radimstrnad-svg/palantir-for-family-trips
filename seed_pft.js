
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding PFT data...');

  // 1. Create Trip
  const { data: trip, error: tripError } = await supabase
    .from('pft_trips')
    .insert([{
      title: 'Pine Mountain Lake / Yosemite Weekend',
      subtitle: 'Thu 4/09 to Sun 4/12',
      command_name: 'Family Trip Command Center',
      basecamp_location: 'Pine Mountain Lake, Groveland, CA 95321',
      basecamp_lat: 37.8586,
      basecamp_lng: -120.2142
    }])
    .select()
    .single();

  if (tripError) {
    console.error('Trip Error:', tripError);
    return;
  }
  const tripId = trip.id;
  console.log('Created Trip:', tripId);

  // 2. Families
  const familiesData = [
    {
      trip_id: tripId,
      name: 'Parkers',
      origin: 'Los Angeles',
      short_origin: 'LA',
      status: 'Transit',
      eta: 'Thu 4:00 PM',
      drive_time: '5.5 hrs',
      headcount: '2 adults, 1 kid',
      vehicle: 'SUV',
      responsibility: 'Firewood + snacks',
      readiness: 82,
      route_summary: 'Single-leg drive from LA to Pine Mountain Lake'
    },
    {
      trip_id: tripId,
      name: 'Jiangs',
      origin: 'San Francisco',
      short_origin: 'SF',
      status: 'Transit',
      eta: 'Thu 4:00 PM',
      drive_time: '3.5 hrs',
      headcount: '2 adults, 1 kid',
      vehicle: 'SUV',
      responsibility: 'Coolers + breakfast fruit',
      readiness: 88,
      route_summary: 'Short Bay Area drive with a quick Oakdale reset before Pine Mountain Lake'
    },
    {
      trip_id: tripId,
      name: 'Riveras',
      origin: 'Reno',
      short_origin: 'RN',
      status: 'Friday Arrival',
      eta: 'Fri 1:00 PM',
      drive_time: '5 hrs',
      headcount: '2 adults, 1 kid',
      vehicle: 'SUV',
      responsibility: 'Grill kit + Saturday lunch',
      readiness: 71,
      route_summary: 'Friday arrival from Reno straight into Pine Mountain Lake'
    }
  ];

  const { data: families, error: familiesError } = await supabase
    .from('pft_families')
    .insert(familiesData)
    .select();

  if (familiesError) {
    console.error('Families Error:', familiesError);
    return;
  }
  console.log('Inserted families');

  // 3. Checklists
  const checklists = [];
  families.forEach(f => {
    if (f.name === 'Parkers') {
        checklists.push({ family_id: f.id, label: 'Car packed night before', done: true });
        checklists.push({ family_id: f.id, label: 'Kid activity bag loaded', done: true });
        checklists.push({ family_id: f.id, label: 'Road snacks secured', done: false });
        checklists.push({ family_id: f.id, label: 'Pickup firewood on arrival', done: false });
    } else if (f.name === 'Jiangs') {
        checklists.push({ family_id: f.id, label: 'Lake towels and floaties', done: true });
        checklists.push({ family_id: f.id, label: 'Breakfast fruit packed', done: true });
        checklists.push({ family_id: f.id, label: 'Kids-shoes for kid', done: false });
        checklists.push({ family_id: f.id, label: 'Portable charger packed', done: true });
    } else if (f.name === 'Riveras') {
        checklists.push({ family_id: f.id, label: 'Friday arrival window confirmed', done: true });
        checklists.push({ family_id: f.id, label: 'Grill kit packed', done: false });
        checklists.push({ family_id: f.id, label: 'Yosemite daypacks staged', done: false });
        checklists.push({ family_id: f.id, label: 'Park entry docs confirmed', done: true });
    }
  });
  await supabase.from('pft_checklists').insert(checklists);

  // 4. Meals
  const meals = [
    { trip_id: tripId, day_name: 'Thursday', meal_name: 'Two Guys Pizza Pies', owner_name: 'Walk-in', status_text: 'Assigned', note: 'Simple first-night pizza dinner plan around 6:00 PM with a one-hour stop before heading back to basecamp' },
    { trip_id: tripId, day_name: 'Friday', meal_name: 'Basecamp breakfast', owner_name: 'Shared', status_text: 'Assigned', note: 'Keep breakfast easy at basecamp before the local Friday reset day' }
    // ... add more if needed, for brevity I'll stop here or add a few more
  ];
  await supabase.from('pft_meals').insert(meals);

  // 5. Itinerary
  const itinerary = [
    { trip_id: tripId, category: 'activities', label: 'Transit + settle in', start_val: 0.7, span_val: 2.53, color: 'critical' },
    { trip_id: tripId, category: 'activities', label: 'Pine Mountain Lake day', start_val: 4, span_val: 4, color: 'info' }
  ];
  await supabase.from('pft_itinerary').insert(itinerary);

  console.log('Seeding complete!');
}

seed();
