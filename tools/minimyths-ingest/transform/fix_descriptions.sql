-- Set battlepacks.description on the imported archive packs.
--
-- The original import never wrote this column at all. Text comes from the
-- event body: the lead paragraphs before the first heading, or, for pages
-- that open with a results table, the blurb under their own Description /
-- Overview heading.
--
-- The Notion 'Event Information' property is deliberately NOT used: it holds
-- the mini-myths.com URL, and a bare link is not a description.
--
-- 39 packs get text; 50 have none anywhere in Notion and stay null.
-- Only non-null values are written, so this never blanks a description
-- someone has since typed. Safe to re-run.

begin;

-- Purple Palette
update public.battlepacks
   set description = 'While we fight so many of our greatest battles across tiny, tiny battlefields, the real fight is the one we share with a paint brush! Come join our very first painting competition for 2024!'
 where id = '4516575f-6f93-5c7b-aca2-6ab8f785bd7b'
   and description is null;

-- Purple Palette: Fluoro
update public.battlepacks
   set description = 'While we fight so many of our greatest battles across tiny, tiny battlefields, the real fight is the one we share with a paint brush! Come join our next painting competition for 2024!'
 where id = 'cadd9c8d-8969-5608-aa7e-892ba343cfcd'
   and description is null;

-- Purple Palette: Fantasy
update public.battlepacks
   set description = 'Hey Folks! It''s time for our third Purple Palette for 2024. Welcome to our Purple Palette III - Return of the Brush! The theme this time around is Fantasy! Dust off some Age of Sigmar, grab your Saga or Bushido miniatures, or start assembling some Lord of the Rings models - if it''s a Fantasy miniature, it''s the perfect choice for this competition. We''ve timed it to align well with the release of Age of Sigmar''s Fourth Edition release, too, so maybe your latest Skaven or Stormcast model can find their way onto the painting table.'
 where id = '1aaae56a-0644-530c-b945-f8973af5b9e2'
   and description is null;

-- Quarmaggedon
update public.battlepacks
   set description = 'Right on the border intersecting Maer Braech, Coftyr, and Western Anyara lies the sleepy town of Gufton. You could say it has a certain je ne sais quoi. Unfortunately, Gufton has been shaken violently awake by Crusader forces directing raids into Coftyr. Similar such raids have been reported all along the border. We fear this may be the beginning of something much, much bigger… The previously untouched town may have just become the focus of a new invasion. The King expects all gentle-quar to work the defences and repel the invaders, while the Crusaders hope to start the final push that will finally bring about Alykinder''s dream of a united Alwyd!'
 where id = '959f1d2d-041d-5804-9b89-256bcfd53155'
   and description is null;

-- Assault on the Brass Citadel
update public.battlepacks
   set description = 'It''s been a while, but Age of Sigmar is back, baby! Let''s get metaphysical with a full-force 2000-point event to kick off April!'
 where id = '74f715e5-f06d-54af-a1d0-f5b996763b9f'
   and description is null;

-- Assault on Alderaan
update public.battlepacks
   set description = 'This year is going fast! With both Arkfest and the Melbourne GT looming around the corner, it''s time to get some last-minute practice in for whichever events you''re planning to attend. As always, we''ll have a squad pack up for grabs and some fun additional prizes to give away. Everything''s a door prize, so performance doesn''t matter — just show up and you could be a winner! No changes to the format this week — just standard, cut-and-dry Showdown Premiere.'
 where id = '719bd904-2f1b-5b18-ac16-9292609a2301'
   and description is null;

-- Casual Casualties
update public.battlepacks
   set description = 'Join us for 2 rounds of Pariah Nexus, using 2000-point lists. Missions will be randomly selected and shuffled on the day by the TO.'
 where id = 'b998b5ac-103f-546e-86a6-151c803c6969'
   and description is null;

-- Arcpoint 2025
update public.battlepacks
   set description = 'Check out the ticket link for all the details on this event. We''ll have more information about the format, and prize support, closer to the date!'
 where id = '6136343b-518c-55af-b215-2095740cfbde'
   and description is null;

-- Defense of Mandalore
update public.battlepacks
   set description = 'Sadly, Arcpoint has been cancelled. However, don''t lose hope (after all, rebellions are built on hope) - instead, come celebrate May 4th in style at Gaming Arena! This event is all about getting reps in before the GT, so we''ll be running standard Showdown Premiere, with standard swiss pairings. We''ll have a few small door prizes available on the day, too!'
 where id = '2e3b8a07-c346-5f3b-8b84-971717571595'
   and description is null;

-- Melee at Mygeeto
update public.battlepacks
   set description = 'The Grand Tournament is a few short weeks away. It''s going to be massive, and it''s a great opportunity for Victoria to defend their homeland! This event is all about getting reps in before the GT, so we''ll be running standard Showdown Premiere, with standard swiss pairings. We''ll have a few small door prizes available on the day, too!'
 where id = '0b09f6dd-fa45-5a1e-b4b4-966dbd45697d'
   and description is null;

-- Chaos Nights
update public.battlepacks
   set description = 'A mysterious psychic energy calls out through the Warp, drawing the attention of all is the Western Sector of the galaxy. At the centre of this psychic call is the solar system of Guf, where the ominous Chaeos Cult plots on the dwarf planet Mythos. Join us for a 6-round matched play league, using the current mission pack, beginning on May 27th. Rounds 1 and 3 are Incursion (1000 points). Rounds 4 to 6 are Strike Force (2000 points)'
 where id = '955e8eb5-e164-5e4e-b291-bddd35d6be90'
   and description is null;

-- MiniMyths Fumble Rumble I
update public.battlepacks
   set description = 'Welcome to the first annual MiniMyths Blood Bowl league! The new league will run for three (3) months with weekly paired games. At the end of the league we will hold a finals to determine the insert trophy name here winner. So let''s get dodgin'', duckin'', passin'' and krumpin''. That''s Blood Bowl Jim! What You Need to Play: A Blood Bowl team of at least 11 players. A set of Blood Bowl Dice (x2 D6, x3 Block D6, x1 D8, x1 D16). Appropriate rules document (Core Manual and/or Spikes). Your team''s roster. Pen and paper to track results and players. A field to play on.'
 where id = 'd3112657-ff86-5b87-b71a-4233ae308816'
   and description is null;

-- Duel of the Fates 2025
update public.battlepacks
   set description = 'Melbourne''s first ever Shatterpoint official GT! After a successful year of monthly Shatterpoint events, culminating in our Shatterpoint Unleashed event at the end of last year, we''re excited to announce this amazing, AMG-supported event. As an officially supported event, we''ll be following all the rules and requirements provided by AMG. We''ll be using Swiss rounds, with no top or bottom cut. We''ll also be using any current errata, rules changes, and released characters/objective packs as of the day of the event. See all the details below!'
 where id = 'a01192de-85c5-5eba-9b51-26e2ff9b6113'
   and description is null;

-- Operation Frostbite Face-Off
update public.battlepacks
   set description = 'Hey all. Come down to Guf Werribee for our next infinity N5 Event. We will be hosting a 3 round, 300-point resilience operations event on the day. Tickets will be $35, and every player will receive 4 HVT markers, 3 Objectives and 2 beacons, so you will have all the items needed to play resilience operations'
 where id = 'f57a3853-4d69-572f-9736-17d154c9a37a'
   and description is null;

-- Jump To Jakku
update public.battlepacks
   set description = 'The GT is over - and the journey to the next GT has just begun! Somehow, Our monthly Shatterpoint at Gaming Arena has returned. And with it has come the might AMG League Kit! Featuring exclusive foil cards and other fun prizes. From now until December, earn progress on a League Leaderboard by attending each Gaming Arena monthly. At the end of the season, we''ll crown our champions and hand over some delicious exclusive bounty for our top-earners. This month, we''ll be doing the Threemiere format - you''ll bring a total of 3 SQUADS, and you must use each squad at least once over the course of the day. Are you new to Shatterpoint? We can provide everything you need to start playing, and best of all - first-time players at our Monthlies enter for free! Reach out to Bam on the Gaming Arena or Mini Myths Discord if you''d like to come along.'
 where id = '63b4a3f6-ba54-5755-b289-9294cc9cec83'
   and description is null;

-- Quarmaggedon II
update public.battlepacks
   set description = 'Gufton has fallen! However, the Crusader victory was a narrow one and although Crusader flags adorn the town, the ''liberating'' army are struggling to hold on to their prize. It has been reported that Royalist forces are regrouping and plan on taking back what''s theirs! The first battle for Gufton relied mainly on infantry, with the exception of a few daring Anyaran daredevils, however the conflict has escalated and tractors are now a common sight across the battlefields. While the town itself has remained relatively untouched except for the aforementioned change in décor – or rather, de-Quar ... – the surrounding areas are almost unrecognisable due to the fiercely fought battles now colloquially known as ''The Quarmaggedon''. Fort Cook is now a fort in name only and the trenches on the outskirts of town are now so large and labyrinthine it''s impossible to tell which side belongs to whom. It is said a tractor can travel from one end to the other with little difficulty, if they can successfully navigate through the winding maze. Worst of all, there are reports that all of the beer reserves at the ''weary bee'' have been completely drained. Will the Crusaders permanently liberate Gufton from the King''s dominion or will the Royalists take back the town for King and Coftyr? Join the second largest Quar event in the southern hemisphere, as far as we know, and help write the story along with us!'
 where id = '10e711a9-ba2f-5da5-89d5-5e9704da5c19'
   and description is null;

-- Casual Casulaties: The Incursion Diversion
update public.battlepacks
   set description = 'The Emperor''s Children have decided its time for a little party! Come join us for two chill rounds of Warhammer 40,000 Incursion.'
 where id = '9fa1f52c-dd44-50a6-9dd8-47b99b38fe48'
   and description is null;

-- Strike on Scarif
update public.battlepacks
   set description = 'We''re at Games Portal for the very first time! Join me as the Outer-Rim League takes a tour to a whole new star-system! This event will be a Showdown Premiere format, but as always, new players are welcome to play a standard Showdown format if they would like.'
 where id = 'ab667366-90b9-577a-a05b-62823b27c3db'
   and description is null;

-- Games Discovery Day
update public.battlepacks
   set description = 'It can be hard to find the time to pick up a whole new game, let alone three - but hey, we''ve found a solution! Come along to our Learn to Play day! For this event, we''re focusing on some of our favourite skirmish games: Kill Team, Warcrow, and Halo: Flashpoint!'
 where id = '5af0ae79-a15d-5799-a30d-fb78951d4f0e'
   and description is null;

-- War for Werribee 2025
update public.battlepacks
   set description = 'This event is a Victoria''s Mightiest Heroes qualifier! Earn points, or even a place, in the VMH masters event later this year. Mini Myths is excited to be collaborating with the best of Victoria''s MCP events to continue Victoria''s Mightiest Heroes - the premiere competitive MCP circuit for Victoria. This year, we''re the final event before the final - so come grab some last minute points and earn your spot!'
 where id = 'a1fb177a-f01e-5040-8859-521e034d9e9a'
   and description is null;

-- Nullification of Narkina
update public.battlepacks
   set description = 'The galactic war (of 2025) is coming to an end, and November marks our penultimate Outer Rim League event! Join us once again at the Gaming Arena to earn more league points and win some more sweet, sweet prizes!'
 where id = '80b0cc46-fe28-5f0b-8161-39f6e9ea25e5'
   and description is null;

-- ORL 2025 Finale
update public.battlepacks
   set description = 'The final event of our 2025 league! Come down and play some games, earn your final points, and send-off the year with an awesome celebration of a great year of Shatterpoint. We''ve partnered up with Victoria''s Mightiest Heroes and their Masters event, so we''ll share a venue, share a meal, and share a great day of gaming!'
 where id = 'c99fb184-33c5-5714-a2a5-cc965816f3e8'
   and description is null;

-- Mini Myths Photo Day!
update public.battlepacks
   set description = 'With Armies on Parade off the table for 2025, we want to make sure we take the time to capture all your amazing miniature projects from the year.'
 where id = 'd1267aee-f387-5fd0-adfa-f8f497c4af7e'
   and description is null;

-- Stumble Rumble I
update public.battlepacks
   set description = 'Welcome to Stumble Rumble—Mini Myth''s premier (and possibly only) Blood Bowl Sevens amateur league, hosted proudly at Guf Werribee! In this league, strategy meets chaos, dice meet destiny, and rookies and useless veterans alike gather each week to indulge in the finest tradition Blood Bowl has to offer; spectacular triumphs, brutal fumbles, and the occasional goblin-related incident.'
 where id = 'a023a6ec-2ab6-55d0-94a9-0b1634b3cf75'
   and description is null;

-- On The March
update public.battlepacks
   set description = 'A few of us will be looking to go to Arc this year, so it is time to turn our minds to 1350 point lists. Whether or not you are going, it would be great if you could join us for three rounds of matched play!'
 where id = '3bb34648-9da9-5e9b-b21a-a274cb21248a'
   and description is null;

-- Clash of Rhyfles Painting Competition
update public.battlepacks
   set description = 'Stole the name from Rob, who suggested Quar-terly events! Now, of course this is all because of our shared love of puns. Seriously speaking, I hope to run a Quar related event each Quarter this year — hoping to have two painting challenges and two one day events. If there''s enough support it should be a wonderful year full of Quar fun!'
 where id = '946519e2-f69e-51f6-afe1-7065e8f0795c'
   and description is null;

-- Flashpoint Fiesta
update public.battlepacks
   set description = 'Halo Flashpoint is the awesome new Halo-themed game from Mantic, and we think it''s gonna be big! It''s tabletop skirmish like you''ve never played before, with unique twists from the video game like picking up weapons on the battlefield, respawning when you die, and more!'
 where id = 'fac0ce91-b970-5486-9909-9f1ad6bb2dcc'
   and description is null;

-- Arcpoint 2026
update public.battlepacks
   set description = 'We''re so excited to be teaming up with the Arcfest team for Arcpoint 2026 - an exciting new Star Wars: Shatterpoint event! This event will be everything you''ve loved about our previous big Shatterpoint events like Duel of the Fates 2025 and the ORL 2025 Finale, but with the added awesomeness that is Arcfest!'
 where id = 'f7fd5587-107f-52da-b62d-5f4b9653d366'
   and description is null;

-- Nemesis Hunt
update public.battlepacks
   set description = 'Nemesis Ops is here! To celebrate this exciting new narrative-driven format for Kill Team, we''ve prepared a special one-day event at Guf where you get to play both the Nemesis and the Hunted!'
 where id = 'd1af7ab1-4c40-548a-8f68-f9c90c21df5b'
   and description is null;

-- Flashpoint: Winter Warfare!
update public.battlepacks
   set description = 'We''re so excited to bring you another Halo Flashpoint event! After the awesome day we had at Flashpoint Fiesta, it''s time to play some full-sized matches. Welcome to Winter Warfare!'
 where id = '6aaa427b-67b0-5a5b-a219-803ace7f96d1'
   and description is null;

-- Duel of the Fates 2026
update public.battlepacks
   set description = 'Melbourne''s only Shatterpoint official GT! We''re back for a second year to celebrate our favourite game in the galaxy! As an officially supported event, we''ll be following all the rules and requirements provided by AMG. The rules for Showdown Premiere can be found here. We''ll be using Swiss rounds, with no top or bottom cut. We''ll also be using any current errata, rules changes, and released characters/objective packs as of the day of the event. See all the details below!'
 where id = 'b46f7193-7c92-51fd-9218-5ed17ee0a9a0'
   and description is null;

-- Fumble Rumble II
update public.battlepacks
   set description = 'Welcome to the second annual Mini-Myths Blood Bowl league! This league will run for 12 weeks with 10 paired games. At the end of the league we will hold a finals to determine the insert trophy name here winner. So let''s get dodgin'', duckin'', passin'' and krumpin''. That''s Blood Bowl Jim!'
 where id = '64d804b9-8c60-5bd0-9df1-2bc213d24f9f'
   and description is null;

-- Quarmageddon III
update public.battlepacks
   set description = 'Gufton remains in Crusader hands. Despite low spirits among the Royalist forces, the King insists on final push to take the beleaguered town and its surrounding areas from Crusader hands once and for all!'
 where id = '84e3d455-6ab5-50c9-a6d7-f3987c9497c3'
   and description is null;

-- Friday Night Hobby!
update public.battlepacks
   set description = 'I know many of us are spending our Friday nights cracking down into hobby - so why not do it together? Jump into the Discord and let us know what you''re working on, and then bring everything down Friday night and socialize while you hobby!'
 where id = '9dc19591-2284-576a-a8dd-b116f39ed7f8'
   and description is null;

-- Time for Armageddon!
update public.battlepacks
   set description = 'It''s time for Warhammer 40,000 11th Edition: Armageddon! Let''s kick things off with a casual, friendly day dedicated to learning the new ruleset and learning our new armies.'
 where id = '24782c81-94a5-54cc-9940-2c75e1464b81'
   and description is null;

-- Top Table Trails
update public.battlepacks
   set description = 'Welcome to our very first event at Top Table Games! This event will be in the Threemiere format, but as always, new players are welcome to play a standard Showdown format if they would like.'
 where id = 'a75b4e5e-c833-5096-8da8-7b84427b802f'
   and description is null;

-- Battle for the Amethyst City
update public.battlepacks
   set description = 'Sorry folks - not quite enough interest in this one with Bloodbowl still going strong and 11th edition just coming out the door. Hopefully we can book this one in again for the future!'
 where id = '757e916a-3cfc-5183-af43-e777edab306d'
   and description is null;

-- Purple Palette 5: He’s Just A Little Guy!
update public.battlepacks
   set description = 'It is time for the long awaited return of Purple Palette! For this event you must paint a single miniature that comes supplied from the manufacturer on a square/round base no bigger than 28mm. Plinths will be allowed for basing but may not exceed 35mm in width/diameter.'
 where id = '2e403025-3a3d-5214-b10f-db4d213b7a1a'
   and description is null;

-- Purple Palette 6: Monster Madness
update public.battlepacks
   set description = 'Paint a single miniature representing a monster, no taller than 30cm. Yes, that excludes Archaon. The height limit includes any base or plinth. Retail miniatures only. Your miniature must come from a retail manufacturer (GW, AMG, Warlord, etc.). 3D-printed miniatures are only allowed if bought already printed from a retail manufacturer. Accessories: 3D-printed and sculpted accessories (heads, weapons, adornments) are allowed. Basing: Optional and completely freeform, so go nuts with it. You may mount your piece on a base or a plinth, as long as the total height stays at or under 30cm. Basing is one of the judging categories, so an unbased entry will likely score lower there. Transfers: Allowed. Backdrops: Allowed, but you must disclose if AI was used to generate the image. Nameplates: Entries are judged anonymously. You''re welcome to add a nameplate with a title. It''s your only chance to tell people about your work.'
 where id = '4ef11e05-f685-58ac-81f0-2b66488b5be6'
   and description is null;

commit;

-- verification, expect 39:
-- select count(*) from public.battlepacks
--   where host_location_id = '53809c67-b6a5-4ebc-8941-9c14da626d5a'
--     and description is not null;
