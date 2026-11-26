# Civics picture plan

Every question of both answer keys, with one picture class and the reason. The class decides what kind of picture, if any, a question may get:

| Class | Meaning | Picture source |
|---|---|---|
| PERSON | a named historical person | federal public-domain portrait (LOC, National Archives, Smithsonian CC0, NPS) |
| PLACE | a building, monument or map | federal public-domain photo, or a map drawn from Census Bureau / USGS data |
| DOCUMENT | the Declaration, the Constitution, the Bill of Rights and other founding papers | federal public-domain scan |
| EVENT | a war, a movement or a purchase | federal public-domain photo or print; for wars and attacks, a memorial instead |
| SYMBOL | the flag, the anthem, national holidays | federal public-domain photo or print; the 50-star flag drawn from the flag code |
| CONCEPT | an abstract idea | AI illustration, shown only after the owner reviews it |
| DYNAMIC | the answer changes (current officeholders, the user's own state) | none |
| NONE | a picture would not help, or would risk a stereotype | none |

AI illustrations are only ever prepared for CONCEPT questions. PERSON, PLACE, DOCUMENT, EVENT, SYMBOL and
DYNAMIC questions never get one: an AI picture of a real person, place, event or document
would be a made-up likeness or a made-up record.

## Counts

A picture can help on **167 of the 228 questions** (all classes except DYNAMIC and NONE). The other 61 are left without one on purpose.

- **Federal pictures** (LOC, National Archives, Smithsonian, NPS): 105 questions.
- **Diagrams drawn from federal data** (Census Bureau, USGS, the flag code): 10 questions, all `reviewed: false` until the owner checks them.
- **AI illustrations** (CONCEPT only): 47 questions reviewed by the owner; 4 more wait for new illustrations (prompts redone, not generated yet).
- **Total with a picture prepared:** 166 of 167. Shown in the app today: 152 of 167 (diagrams and the 4 redone illustrations appear once reviewed).
- **Still missing:** 1 (2025-116); see `docs/image-todo.md`.

Each question counts once per answer key. Before this work (step P0) 49 questions had a picture.

| Class | Questions | Federal | Diagram | AI (reviewed) | AI (waiting) | No picture |
|---|---|---|---|---|---|---|
| PERSON | 23 | 23 | 0 | 0 | 0 | 0 |
| PLACE | 22 | 14 | 8 | 0 | 0 | 0 |
| DOCUMENT | 22 | 22 | 0 | 0 | 0 | 0 |
| EVENT | 37 | 36 | 0 | 0 | 0 | 1 |
| SYMBOL | 12 | 10 | 2 | 0 | 0 | 0 |
| CONCEPT | 51 | 0 | 0 | 47 | 4 | 0 |
| DYNAMIC | 18 | 0 | 0 | 0 | 0 | 18 |
| NONE | 43 | 0 | 0 | 0 | 0 | 43 |
| **All** | **228** | **105** | **10** | **47** | **4** | **62** |

## AI illustrations for CONCEPT questions

Read on 2026-11-26 from the OpenAI image generation guide (<https://developers.openai.com/api/docs/guides/image-generation>),
the model page (<https://developers.openai.com/api/docs/models/gpt-image-2.6-flare>) and the pricing page
(<https://developers.openai.com/api/docs/pricing>):

- **Model:** `gpt-image-2.6-flare` (GPT-Image-2.6 Flare, "for fast iteration"; endpoint `v1/images/generations`). The guide names GPT-Image-2.6 Sunburst and Flare for new integrations.
- **Size and quality used:** `1024x1024`, quality `medium`. The API returns base64 PNG; the tool converts it to WebP (longest side 1200px, about 150 kB or less).
- **Price:** $30 per 1M image output tokens and $5 per 1M text input tokens. The docs give no fixed per-image price for GPT-Image-2.6 (only an interactive calculator). The per-image table for `gpt-image-2`, at the same $30 output rate, lists $0.053 for medium quality at 1024x1024. Estimate used: **about $0.055 per image** (output plus the prompt text). Token use can differ by model, so the real cost may differ.
- **Prompts:** one per CONCEPT idea in `data/images/illustration-prompts.json` (34 prompts covering all 51 CONCEPT questions). Dry run: `node --no-warnings tools/images/generate-illustrations.mjs`.

## 2008 answer key

| Id | Question | Class | Reason | Picture |
|---|---|---|---|---|
| 2008-001 | What is the supreme law of the land? | DOCUMENT | the U.S. Constitution itself (its first page shows the words of the question) | federal (`constitution-page-one`) |
| 2008-002 | What does the Constitution do? | DOCUMENT | the U.S. Constitution itself (its first page shows the words of the question) | federal (`constitution-page-one`) |
| 2008-003 | The idea of self-government is in the first three words of the Constitution. What are these words? | DOCUMENT | the U.S. Constitution itself (its first page shows the words of the question) | federal (`constitution-page-one`) |
| 2008-004 | What is an amendment? | CONCEPT | an amendment is a change to a document: an idea, not a thing | AI (`amendment-change`) |
| 2008-005 | What do we call the first ten amendments to the Constitution? | DOCUMENT | the Bill of Rights document | federal (`bill-of-rights`) |
| 2008-006 | What is one right or freedom from the First Amendment? | CONCEPT | a freedom (speech, religion, press): an idea | AI (`first-amendment-freedoms`) |
| 2008-007 | How many amendments does the Constitution have? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-008 | What did the Declaration of Independence do? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2008-009 | What are two rights in the Declaration of Independence? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2008-010 | What is freedom of religion? | CONCEPT | freedom of religion: an idea | AI (`freedom-of-religion`) |
| 2008-011 | What is the economic system in the United States? | CONCEPT | an economic system: an idea | AI (`economic-system`) |
| 2008-012 | What is the “rule of law”? | CONCEPT | the rule of law: an idea | AI (`rule-of-law`) |
| 2008-013 | Name one branch or part of the government. | CONCEPT | the three branches of government: a structure, not one building | AI (`three-branches`) |
| 2008-014 | What stops one branch of government from becoming too powerful? | CONCEPT | checks and balances: an idea | AI (`checks-and-balances`) |
| 2008-015 | Who is in charge of the executive branch? | PLACE | the executive branch: the White House is its building | federal (`white-house-1906`) |
| 2008-016 | Who makes federal laws? | PLACE | Congress: the U.S. Capitol | federal (`us-capitol-1875`) |
| 2008-017 | What are the two parts of the U.S. Congress? | PLACE | Congress: the U.S. Capitol | federal (`us-capitol-1875`) |
| 2008-018 | How many U.S. Senators are there? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-019 | We elect a U.S. Senator for how many years? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-020 | Who is one of your state’s U.S. Senators now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-021 | The House of Representatives has how many voting members? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-022 | We elect a U.S. Representative for how many years? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-023 | Name your U.S. Representative. | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-024 | Who does a U.S. Senator represent? | CONCEPT | who a member of Congress represents: an idea (the people of a state or district) | AI (`senator-represents-state`) |
| 2008-025 | Why do some states have more Representatives than other states? | CONCEPT | representation by population: an idea | AI (`seats-by-population`) |
| 2008-026 | We elect a President for how many years? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-027 | In what month do we vote for President? | CONCEPT | election day in November: the idea of voting | AI (`election-month`) |
| 2008-028 | What is the name of the President of the United States now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-029 | What is the name of the Vice President of the United States now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-030 | If the President can no longer serve, who becomes President? | NONE | who becomes President: a rule of succession; a picture of an officeholder would be a current person | no |
| 2008-031 | If both the President and the Vice President can no longer serve, who becomes President? | NONE | who becomes President: a rule of succession; a picture of an officeholder would be a current person | no |
| 2008-032 | Who is the Commander in Chief of the military? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2008-033 | Who signs bills to become laws? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2008-034 | Who vetoes bills? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2008-035 | What does the President’s Cabinet do? | CONCEPT | the Cabinet advises the President: an idea | AI (`cabinet-advises`) |
| 2008-036 | What are two Cabinet-level positions? | NONE | a list of offices; a picture would not help | no |
| 2008-037 | What does the judicial branch do? | CONCEPT | what courts do: an idea | AI, waiting (`judicial-branch`) |
| 2008-038 | What is the highest court in the United States? | PLACE | the Supreme Court building | federal (`supreme-court-1931`) |
| 2008-039 | How many justices are on the Supreme Court? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-040 | Who is the Chief Justice of the United States now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-041 | Under our Constitution, some powers belong to the federal government. What is one power of the federal government? | CONCEPT | federal and state powers: an idea | AI (`federal-powers`) |
| 2008-042 | Under our Constitution, some powers belong to the states. What is one power of the states? | CONCEPT | federal and state powers: an idea | AI (`state-powers`) |
| 2008-043 | Who is the Governor of your state now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-044 | What is the capital of your state? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-045 | What are the two major political parties in the United States? | NONE | party names; party symbols are logos, not used | no |
| 2008-046 | What is the political party of the President now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-047 | What is the name of the Speaker of the House of Representatives now? | DYNAMIC | the answer changes (current officeholders, a state's own answer, or marked dynamic in the answer key); no picture | no |
| 2008-048 | There are four amendments to the Constitution about who can vote. Describe one of them. | CONCEPT | voting rights amendments: the idea of the right to vote | AI (`voting-amendments`) |
| 2008-049 | What is one responsibility that is only for United States citizens? | CONCEPT | rights and duties of citizens: ideas | AI (`citizen-responsibilities`) |
| 2008-050 | Name one right only for United States citizens. | CONCEPT | rights and duties of citizens: ideas | AI (`citizen-rights`) |
| 2008-051 | What are two rights of everyone living in the United States? | CONCEPT | rights and duties of citizens: ideas | AI (`rights-of-everyone`) |
| 2008-052 | What do we show loyalty to when we say the Pledge of Allegiance? | SYMBOL | the U.S. flag | federal (`american-flag-1914`) |
| 2008-053 | What is one promise you make when you become a United States citizen? | CONCEPT | the oath and becoming a citizen: an idea | AI (`oath-promises`) |
| 2008-054 | How old do citizens have to be to vote for President? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2008-055 | What are two ways that Americans can participate in their democracy? | CONCEPT | taking part in democracy and serving the country: ideas | AI (`civic-participation`) |
| 2008-056 | When is the last day you can send in federal income tax forms? | NONE | a date for tax forms; a picture would not help | no |
| 2008-057 | When must all men register for the Selective Service? | NONE | registering for the Selective Service: a rule; a picture would not help | no |
| 2008-058 | What is one reason colonists came to America? | EVENT | the colonists' arrival in America | federal (`landing-of-the-pilgrims-rothermel`) |
| 2008-059 | Who lived in America before the Europeans arrived? | NONE | American Indians: a picture of one people or tribe risks a stereotype; the words are enough | no |
| 2008-060 | What group of people was taken to America and sold as slaves? | NONE | the enslaved people taken to America: not shown as a picture out of respect; the words are enough | no |
| 2008-061 | Why did the colonists fight the British? | EVENT | the American Revolution | federal (`battle-of-lexington`) |
| 2008-062 | Who wrote the Declaration of Independence? | PERSON | Thomas Jefferson | federal (`thomas-jefferson-edwin`) |
| 2008-063 | When was the Declaration of Independence adopted? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2008-064 | There were 13 original states. Name three. | PLACE | a map of the 13 original states | diagram (`thirteen-original-states`) |
| 2008-065 | What happened at the Constitutional Convention? | EVENT | the Constitutional Convention | federal (`constitution-signing-poster`) |
| 2008-066 | When was the Constitution written? | DOCUMENT | the Constitution, written in 1787 | federal (`constitution-page-one`) |
| 2008-067 | The Federalist Papers supported the passage of the U.S. Constitution. Name one of the writers. | PERSON | the writers of the Federalist Papers (James Madison, Alexander Hamilton, John Jay) | federal (`john-jay-stuart`) |
| 2008-068 | What is one thing Benjamin Franklin is famous for? | PERSON | Benjamin Franklin | federal (`benjamin-franklin-chevillet`) |
| 2008-069 | Who is the “Father of Our Country”? | PERSON | George Washington | federal (`george-washington-peale`) |
| 2008-070 | Who was the first President? | PERSON | George Washington | federal (`george-washington-peale`) |
| 2008-071 | What territory did the United States buy from France in 1803? | EVENT | the Louisiana Purchase | federal (`louisiana-purchase`) |
| 2008-072 | Name one war fought by the United States in the 1800s. | EVENT | wars of the 1800s | federal (`battle-of-gettysburg`) |
| 2008-073 | Name the U.S. war between the North and the South. | EVENT | the Civil War | federal (`battle-of-gettysburg`) |
| 2008-074 | Name one problem that led to the Civil War. | EVENT | the Civil War | federal (`battle-of-gettysburg`) |
| 2008-075 | What was one important thing that Abraham Lincoln did? | PERSON | Abraham Lincoln | federal (`abraham-lincoln-healy`) |
| 2008-076 | What did the Emancipation Proclamation do? | DOCUMENT | the Emancipation Proclamation | federal (`emancipation-proclamation-print`) |
| 2008-077 | What did Susan B. Anthony do? | PERSON | Susan B. Anthony (the women's rights movement) | federal (`susan-b-anthony-sarony`) |
| 2008-078 | Name one war fought by the United States in the 1900s. | EVENT | wars of the 1900s | federal (`world-war-one-trench`) |
| 2008-079 | Who was President during World War I? | PERSON | Woodrow Wilson | federal (`woodrow-wilson-tarbell`) |
| 2008-080 | Who was President during the Great Depression and World War II? | PERSON | Franklin D. Roosevelt | federal (`franklin-d-roosevelt-hubbell`) |
| 2008-081 | Who did the United States fight in World War II? | EVENT | World War II | federal (`world-war-ii-memorial-aerial`) |
| 2008-082 | Before he was President, Eisenhower was a general. What war was he in? | PERSON | Dwight D. Eisenhower | federal (`dwight-d-eisenhower-warnecke`) |
| 2008-083 | During the Cold War, what was the main concern of the United States? | EVENT | the Cold War | federal (`inf-treaty-signing-1987`) |
| 2008-084 | What movement tried to end racial discrimination? | EVENT | the civil rights movement | federal (`march-on-washington-1963`) |
| 2008-085 | What did Martin Luther King, Jr. do? | PERSON | Martin Luther King, Jr. | federal (`martin-luther-king-march-1963`) |
| 2008-086 | What major event happened on September 11, 2001, in the United States? | EVENT | the attacks of September 11, 2001 | federal (`flight-93-national-memorial`) |
| 2008-087 | Name one American Indian tribe in the United States. | NONE | American Indians: a picture of one people or tribe risks a stereotype; the words are enough | no |
| 2008-088 | Name one of the two longest rivers in the United States. | PLACE | a map of the United States (rivers) | diagram (`longest-rivers`) |
| 2008-089 | What ocean is on the West Coast of the United States? | PLACE | a map of the United States (oceans) | diagram (`pacific-coast`) |
| 2008-090 | What ocean is on the East Coast of the United States? | PLACE | a map of the United States (oceans) | diagram (`atlantic-coast`) |
| 2008-091 | Name one U.S. territory. | PLACE | a map of the U.S. territories | diagram (`us-territories`) |
| 2008-092 | Name one state that borders Canada. | PLACE | a map of the United States (borders) | diagram (`canada-border-states`) |
| 2008-093 | Name one state that borders Mexico. | PLACE | a map of the United States (borders) | diagram (`mexico-border-states`) |
| 2008-094 | What is the capital of the United States? | PLACE | Washington, D.C. | federal (`washington-monument-1889`) |
| 2008-095 | Where is the Statue of Liberty? | PLACE | the Statue of Liberty | federal (`statue-of-liberty-1885`) |
| 2008-096 | Why does the flag have 13 stripes? | SYMBOL | the U.S. flag (stripes and stars) | federal (`american-flag-1914`) |
| 2008-097 | Why does the flag have 50 stars? | SYMBOL | the U.S. flag (stripes and stars) | diagram (`us-flag-50`) |
| 2008-098 | What is the name of the national anthem? | SYMBOL | the national anthem | federal (`star-spangled-banner-music`) |
| 2008-099 | When do we celebrate Independence Day? | SYMBOL | Independence Day, a national holiday | federal (`fourth-of-july-fireworks`) |
| 2008-100 | Name two national U.S. holidays. | NONE | a list of holidays; one picture would show only one | no |

## 2025 answer key

| Id | Question | Class | Reason | Picture |
|---|---|---|---|---|
| 2025-001 | What is the form of government of the United States? | CONCEPT | the form of government (a republic, a democracy): an idea | AI (`form-of-government`) |
| 2025-002 | What is the supreme law of the land? | DOCUMENT | the U.S. Constitution itself (its first page shows the words of the question) | federal (`constitution-page-one`) |
| 2025-003 | Name one thing the U.S. Constitution does. | DOCUMENT | the U.S. Constitution itself (its first page shows the words of the question) | federal (`constitution-page-one`) |
| 2025-004 | The U.S. Constitution starts with the words “We the People.” What does “We the People” mean? | DOCUMENT | the U.S. Constitution itself (its first page shows the words of the question) | federal (`constitution-page-one`) |
| 2025-005 | How are changes made to the U.S. Constitution? | CONCEPT | an amendment is a change to a document: an idea, not a thing | AI (`amendment-change`) |
| 2025-006 | What does the Bill of Rights protect? | DOCUMENT | the Bill of Rights document | federal (`bill-of-rights`) |
| 2025-007 | How many amendments does the U.S. Constitution have? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-008 | Why is the Declaration of Independence important? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2025-009 | What founding document said the American colonies were free from Britain? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2025-010 | Name two important ideas from the Declaration of Independence and the U.S. Constitution. | CONCEPT | ideas from the founding documents (equality, liberty): ideas | AI (`founding-ideas`) |
| 2025-011 | The words “Life, Liberty, and the pursuit of Happiness” are in what founding document? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2025-012 | What is the economic system of the United States? | CONCEPT | an economic system: an idea | AI (`economic-system`) |
| 2025-013 | What is the rule of law? | CONCEPT | the rule of law: an idea | AI (`rule-of-law`) |
| 2025-014 | Many documents influenced the U.S. Constitution. Name one. | DOCUMENT | documents that influenced the Constitution (the Articles of Confederation is one answer) | federal (`articles-of-confederation`) |
| 2025-015 | There are three branches of government. Why? | CONCEPT | checks and balances: an idea | AI (`checks-and-balances`) |
| 2025-016 | Name the three branches of government. | CONCEPT | the three branches of government: a structure, not one building | AI (`three-branches`) |
| 2025-017 | The President of the United States is in charge of which branch of government? | PLACE | the executive branch: the White House is its building | federal (`white-house-1906`) |
| 2025-018 | What part of the federal government writes laws? | PLACE | Congress: the U.S. Capitol | federal (`us-capitol-1875`) |
| 2025-019 | What are the two parts of the U.S. Congress? | PLACE | Congress: the U.S. Capitol | federal (`us-capitol-1875`) |
| 2025-020 | Name one power of the U.S. Congress. | PLACE | Congress: the U.S. Capitol | federal (`us-capitol-1875`) |
| 2025-021 | How many U.S. senators are there? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-022 | How long is a term for a U.S. senator? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-023 | Who is one of your state’s U.S. senators now? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-024 | How many voting members are in the House of Representatives? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-025 | How long is a term for a member of the House of Representatives? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-026 | Why do U.S. representatives serve shorter terms than U.S. senators? | CONCEPT | why a rule exists (terms, two senators, term limits, life tenure): an idea | AI (`shorter-terms`) |
| 2025-027 | How many senators does each state have? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-028 | Why does each state have two senators? | CONCEPT | why a rule exists (terms, two senators, term limits, life tenure): an idea | AI (`two-senators-each`) |
| 2025-029 | Name your U.S. representative. | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-030 | What is the name of the Speaker of the House of Representatives now? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-031 | Who does a U.S. senator represent? | CONCEPT | who a member of Congress represents: an idea (the people of a state or district) | AI (`senator-represents-state`) |
| 2025-032 | Who elects U.S. senators? | CONCEPT | citizens elect their representatives: an idea | AI (`citizens-elect`) |
| 2025-033 | Who does a member of the House of Representatives represent? | CONCEPT | who a member of Congress represents: an idea (the people of a state or district) | AI (`house-member-district`) |
| 2025-034 | Who elects members of the House of Representatives? | CONCEPT | citizens elect their representatives: an idea | AI (`citizens-elect`) |
| 2025-035 | Some states have more representatives than other states. Why? | CONCEPT | representation by population: an idea | AI (`seats-by-population`) |
| 2025-036 | The President of the United States is elected for how many years? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-037 | The President of the United States can serve only two terms. Why? | CONCEPT | why a rule exists (terms, two senators, term limits, life tenure): an idea | AI, waiting (`two-term-limit`) |
| 2025-038 | What is the name of the President of the United States now? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-039 | What is the name of the Vice President of the United States now? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-040 | If the president can no longer serve, who becomes president? | NONE | who becomes President: a rule of succession; a picture of an officeholder would be a current person | no |
| 2025-041 | Name one power of the president. | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2025-042 | Who is Commander in Chief of the U.S. military? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2025-043 | Who signs bills to become laws? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2025-044 | Who vetoes bills? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2025-045 | Who appoints federal judges? | NONE | the answer is the President's role; a picture would show a person or be decoration | no |
| 2025-046 | The executive branch has many parts. Name one. | NONE | a list of offices; a picture would not help | no |
| 2025-047 | What does the President’s Cabinet do? | CONCEPT | the Cabinet advises the President: an idea | AI (`cabinet-advises`) |
| 2025-048 | What are two Cabinet-level positions? | NONE | a list of offices; a picture would not help | no |
| 2025-049 | Why is the Electoral College important? | CONCEPT | the Electoral College: an idea | AI (`electoral-college`) |
| 2025-050 | What is one part of the judicial branch? | PLACE | the Supreme Court building | federal (`supreme-court-1931`) |
| 2025-051 | What does the judicial branch do? | CONCEPT | what courts do: an idea | AI, waiting (`judicial-branch`) |
| 2025-052 | What is the highest court in the United States? | PLACE | the Supreme Court building | federal (`supreme-court-1931`) |
| 2025-053 | How many seats are on the Supreme Court? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-054 | How many Supreme Court justices are usually needed to decide a case? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-055 | How long do Supreme Court justices serve? | NONE | the answer is a number of seats, years or votes; a picture would not help | no |
| 2025-056 | Supreme Court justices serve for life. Why? | CONCEPT | why a rule exists (terms, two senators, term limits, life tenure): an idea | AI (`judges-serve-for-life`) |
| 2025-057 | Who is the Chief Justice of the United States now? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-058 | Name one power that is only for the federal government. | CONCEPT | federal and state powers: an idea | AI (`federal-powers`) |
| 2025-059 | Name one power that is only for the states. | CONCEPT | federal and state powers: an idea | AI (`state-powers`) |
| 2025-060 | What is the purpose of the 10th Amendment? | CONCEPT | federal and state powers: an idea | AI (`tenth-amendment`) |
| 2025-061 | Who is the governor of your state now? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-062 | What is the capital of your state? | DYNAMIC | the answer changes (current officeholders or a state's own answer); no picture | no |
| 2025-063 | There are four amendments to the U.S. Constitution about who can vote. Describe one of them. | CONCEPT | voting rights amendments: the idea of the right to vote | AI (`voting-amendments`) |
| 2025-064 | Who can vote in federal elections, run for federal office, and serve on a jury in the United States? | CONCEPT | rights and duties of citizens: ideas | AI (`citizen-rights`) |
| 2025-065 | What are three rights of everyone living in the United States? | CONCEPT | rights and duties of citizens: ideas | AI (`rights-of-everyone`) |
| 2025-066 | What do we show loyalty to when we say the Pledge of Allegiance? | SYMBOL | the U.S. flag | federal (`american-flag-1914`) |
| 2025-067 | Name two promises that new citizens make in the Oath of Allegiance. | CONCEPT | the oath and becoming a citizen: an idea | AI (`oath-promises`) |
| 2025-068 | How can people become United States citizens? | CONCEPT | the oath and becoming a citizen: an idea | AI (`becoming-citizens`) |
| 2025-069 | What are two examples of civic participation in the United States? | CONCEPT | taking part in democracy and serving the country: ideas | AI (`civic-participation`) |
| 2025-070 | What is one way Americans can serve their country? | CONCEPT | taking part in democracy and serving the country: ideas | AI (`serving-the-country`) |
| 2025-071 | Why is it important to pay federal taxes? | CONCEPT | why people pay taxes: an idea | AI, waiting (`paying-taxes`) |
| 2025-072 | It is important for all men age 18 through 25 to register for the Selective Service. Name one reason why. | NONE | registering for the Selective Service: a rule; a picture would not help | no |
| 2025-073 | The colonists came to America for many reasons. Name one. | EVENT | the colonists' arrival in America | federal (`landing-of-the-pilgrims-rothermel`) |
| 2025-074 | Who lived in America before the Europeans arrived? | NONE | American Indians: a picture of one people or tribe risks a stereotype; the words are enough | no |
| 2025-075 | What group of people was taken and sold as slaves? | NONE | the enslaved people taken to America: not shown as a picture out of respect; the words are enough | no |
| 2025-076 | What war did the Americans fight to win independence from Britain? | EVENT | the American Revolution | federal (`battle-of-lexington`) |
| 2025-077 | Name one reason why the Americans declared independence from Britain. | EVENT | the American Revolution | federal (`declaration-of-independence-engraving`) |
| 2025-078 | Who wrote the Declaration of Independence? | PERSON | Thomas Jefferson | federal (`thomas-jefferson-edwin`) |
| 2025-079 | When was the Declaration of Independence adopted? | DOCUMENT | the Declaration of Independence | federal (`declaration-of-independence-engraving`) |
| 2025-080 | The American Revolution had many important events. Name one. | EVENT | the American Revolution | federal (`battle-of-lexington`) |
| 2025-081 | There were 13 original states. Name five. | PLACE | a map of the 13 original states | diagram (`thirteen-original-states`) |
| 2025-082 | What founding document was written in 1787? | DOCUMENT | the Constitution, written in 1787 | federal (`constitution-page-one`) |
| 2025-083 | The Federalist Papers supported the passage of the U.S. Constitution. Name one of the writers. | PERSON | the writers of the Federalist Papers (James Madison, Alexander Hamilton, John Jay) | federal (`john-jay-stuart`) |
| 2025-084 | Why were the Federalist Papers important? | DOCUMENT | the Federalist Papers (a printed book) | federal (`federalist-1788-page`) |
| 2025-085 | Benjamin Franklin is famous for many things. Name one. | PERSON | Benjamin Franklin | federal (`benjamin-franklin-chevillet`) |
| 2025-086 | George Washington is famous for many things. Name one. | PERSON | George Washington | federal (`george-washington-peale`) |
| 2025-087 | Thomas Jefferson is famous for many things. Name one. | PERSON | Thomas Jefferson | federal (`thomas-jefferson-edwin`) |
| 2025-088 | James Madison is famous for many things. Name one. | PERSON | James Madison | federal (`james-madison-harding`) |
| 2025-089 | Alexander Hamilton is famous for many things. Name one. | PERSON | Alexander Hamilton | federal (`alexander-hamilton-field`) |
| 2025-090 | What territory did the United States buy from France in 1803? | EVENT | the Louisiana Purchase | federal (`louisiana-purchase`) |
| 2025-091 | Name one war fought by the United States in the 1800s. | EVENT | wars of the 1800s | federal (`battle-of-gettysburg`) |
| 2025-092 | Name the U.S. war between the North and the South. | EVENT | the Civil War | federal (`battle-of-gettysburg`) |
| 2025-093 | The Civil War had many important events. Name one. | EVENT | the Civil War | federal (`battle-of-gettysburg`) |
| 2025-094 | Abraham Lincoln is famous for many things. Name one. | PERSON | Abraham Lincoln | federal (`abraham-lincoln-healy`) |
| 2025-095 | What did the Emancipation Proclamation do? | DOCUMENT | the Emancipation Proclamation | federal (`emancipation-proclamation-print`) |
| 2025-096 | What U.S. war ended slavery? | EVENT | the Civil War | federal (`battle-of-gettysburg`) |
| 2025-097 | What amendment says all persons born or naturalized in the United States, and subject to the jurisdiction thereof, are U.S. citizens? | DOCUMENT | the 14th Amendment | federal (`fourteenth-amendment`) |
| 2025-098 | When did all men get the right to vote? | EVENT | the 15th Amendment (1870): all men get the right to vote | federal (`fifteenth-amendment`) |
| 2025-099 | Name one leader of the women’s rights movement in the 1800s. | PERSON | Susan B. Anthony (the women's rights movement) | federal (`susan-b-anthony-sarony`) |
| 2025-100 | Name one war fought by the United States in the 1900s. | EVENT | wars of the 1900s | federal (`world-war-one-trench`) |
| 2025-101 | Why did the United States enter World War I? | EVENT | World War I | federal (`world-war-one-trench`) |
| 2025-102 | When did all women get the right to vote? | EVENT | the 19th Amendment (1920): women get the right to vote | federal (`suffrage-parade-1913`) |
| 2025-103 | What was the Great Depression? | EVENT | the Great Depression | federal (`depression-breadline-sculpture`) |
| 2025-104 | When did the Great Depression start? | EVENT | the Great Depression | federal (`depression-breadline-sculpture`) |
| 2025-105 | Who was president during the Great Depression and World War II? | PERSON | Franklin D. Roosevelt | federal (`franklin-d-roosevelt-hubbell`) |
| 2025-106 | Why did the United States enter World War II? | EVENT | World War II | federal (`world-war-ii-memorial-aerial`) |
| 2025-107 | Dwight Eisenhower is famous for many things. Name one. | PERSON | Dwight D. Eisenhower | federal (`dwight-d-eisenhower-warnecke`) |
| 2025-108 | Who was the United States’ main rival during the Cold War? | EVENT | the Cold War | federal (`inf-treaty-signing-1987`) |
| 2025-109 | During the Cold War, what was one main concern of the United States? | EVENT | the Cold War | federal (`inf-treaty-signing-1987`) |
| 2025-110 | Why did the United States enter the Korean War? | EVENT | the Korean War | federal (`korean-war-veterans-memorial`) |
| 2025-111 | Why did the United States enter the Vietnam War? | EVENT | the Vietnam War | federal (`vietnam-veterans-memorial-snow`) |
| 2025-112 | What did the civil rights movement do? | EVENT | the civil rights movement | federal (`march-on-washington-1963`) |
| 2025-113 | Martin Luther King, Jr. is famous for many things. Name one. | PERSON | Martin Luther King, Jr. | federal (`martin-luther-king-march-1963`) |
| 2025-114 | Why did the United States enter the Persian Gulf War? | EVENT | the Persian Gulf War | federal (`uss-ranger-returns-1991`) |
| 2025-115 | What major event happened on September 11, 2001 in the United States? | EVENT | the attacks of September 11, 2001 | federal (`flight-93-national-memorial`) |
| 2025-116 | Name one U.S. military conflict after the September 11, 2001 attacks. | EVENT | military conflicts after September 11, 2001 | no |
| 2025-117 | Name one American Indian tribe in the United States. | NONE | American Indians: a picture of one people or tribe risks a stereotype; the words are enough | no |
| 2025-118 | Name one example of an American innovation. | EVENT | an American innovation (the first airplane flight is one answer) | federal (`wright-first-flight`) |
| 2025-119 | What is the capital of the United States? | PLACE | Washington, D.C. | federal (`washington-monument-1889`) |
| 2025-120 | Where is the Statue of Liberty? | PLACE | the Statue of Liberty | federal (`statue-of-liberty-1885`) |
| 2025-121 | Why does the flag have 13 stripes? | SYMBOL | the U.S. flag (stripes and stars) | federal (`american-flag-1914`) |
| 2025-122 | Why does the flag have 50 stars? | SYMBOL | the U.S. flag (stripes and stars) | diagram (`us-flag-50`) |
| 2025-123 | What is the name of the national anthem? | SYMBOL | the national anthem | federal (`star-spangled-banner-music`) |
| 2025-124 | The Nation’s first motto was “E Pluribus Unum.” What does that mean? | CONCEPT | the meaning of the motto "E Pluribus Unum" (out of many, one): an idea | AI (`out-of-many-one`) |
| 2025-125 | What is Independence Day? | SYMBOL | Independence Day, a national holiday | federal (`fourth-of-july-fireworks`) |
| 2025-126 | Name three national U.S. holidays. | NONE | a list of holidays; one picture would show only one | no |
| 2025-127 | What is Memorial Day? | SYMBOL | Memorial Day, a national holiday | federal (`decoration-day-1917`) |
| 2025-128 | What is Veterans Day? | SYMBOL | Veterans Day, a national holiday | federal (`armistice-day-1922`) |
