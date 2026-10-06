// Avatar imports for virtual employees
import andreasBraun from './andreas-braun.png';
import kerstinHartmann from './kerstin-hartmann.png';
import patrickHofmann from './patrick-hofmann.png';
import danielKlein from './daniel-klein.png';
import stefanKoch from './stefan-koch.png';
import sebastianKoehler from './sebastian-koehler.png';
import petraKrueger from './petra-krueger.png';
import markusLange from './markus-lange.png';
import jensLehmann from './jens-lehmann.png';
import melanieMaier from './melanie-maier.png';
import heikeMeier from './heike-meier.png';
import nicoleNeumann from './nicole-neumann.png';
import lauraRichter from './laura-richter.png';
import anjaSchmid from './anja-schmid.png';
import frankSchmitt from './frank-schmitt.png';
import martinSchroeder from './martin-schroeder.png';
import mariaSchulz from './maria-schulz.png';
import tobiasSchulze from './tobias-schulze.png';
import christianSchwarz from './christian-schwarz.png';
import monikaWerner from './monika-werner.png';
import sandraWolf from './sandra-wolf.png';
import sabineZimmermann from './sabine-zimmermann.png';
import lisaBecker from './lisa-becker.png';
import janHoffmann from './jan-hoffmann.png';
import maxMueller from './max-mueller.png';
import thomasSchmidt from './thomas-schmidt.png';
import alexanderWagner from './alexander-wagner.png';
import sarahFischer from './sarah-fischer.png';
import juliaWeber from './julia-weber.png';
// Sales & Business
import michaelBraun from './michael-braun.png';
import claudiaMeyer from './claudia-meyer.png';
import annaSchneider from './anna-schneider.png';

// Map employee IDs to their avatar images
export const avatarMap: Record<string, string> = {
  // Compliance & Operations
  '08b17c6b-d86d-4ce2-8e12-44acddf874a6': andreasBraun,
  '92c1f5a4-0001-4f3e-b1d3-1794d1ac0a8a': kerstinHartmann,
  'f6580df5-6293-4bba-ba3d-a11495267121': patrickHofmann,
  'd8b6a336-e0a5-40cb-b7f9-5b45d1fbaf33': danielKlein,
  '9b0cc625-5ff8-4318-bb5f-e3e08789baa3': stefanKoch,
  '75fd382e-3b69-45f6-90a3-4acbd03fca9d': sebastianKoehler,
  '39897eb4-6031-4734-a23a-6a251162a457': petraKrueger,
  '99ceb6a0-44b3-4a07-863b-301d47c1db4c': markusLange,
  '33479a35-e4f6-4631-82a1-a209b096b207': jensLehmann,
  'bf525dd5-07b4-4ac2-92fe-d7ac6d6d4231': melanieMaier,
  'fb92053f-8d2b-48f0-b790-d7cce8ebf57d': heikeMeier,
  '87fea7c1-74e6-47be-95fa-dd252f54ac24': nicoleNeumann,
  'f7d6f9e3-014a-4885-bfb8-2a80a3973b31': lauraRichter,
  '4d399f63-776c-47ca-afd0-78072290812a': anjaSchmid,
  '06608a30-6852-4b91-bd2b-0fd35f358768': frankSchmitt,
  '674b5081-3737-46f3-8368-f219546b4252': martinSchroeder,
  '0c5a3577-ead5-4e3d-826a-5fbaa91450e0': mariaSchulz,
  'c6324317-c2ca-4873-9169-31d8004e13e5': tobiasSchulze,
  '5bad009e-d354-4074-b6b2-ef12e4c9d187': christianSchwarz,
  'c113b22f-2d7f-4001-a490-eb356dda8fc5': monikaWerner,
  '4a057839-0f7f-4101-84db-ec3f5e353e6b': sandraWolf,
  'b01ae550-0a7b-47cc-b465-aeefbfe46188': sabineZimmermann,
  // Engineering
  'c023b46f-021b-4965-99b4-5d4ec94cf89b': lisaBecker,
  '803aea7c-9359-43e5-86b8-201781ac1a67': janHoffmann,
  '4efe3cb5-cfe0-42db-bb5b-6e931f533d4a': maxMueller,
  '72192441-f478-420a-96df-cc01f440b9b1': thomasSchmidt,
  '1fab5b7c-9397-40d0-b523-ef79932fa4a0': alexanderWagner,
  // Product & Design
  'f5b120d5-6e06-45cc-a62c-30ac92ff137b': sarahFischer,
  'a27a9f82-6481-4506-90b6-ab10e63fdb18': juliaWeber,
  // Sales & Business
  '2c45c289-3976-4ba3-89e7-d38d3512a063': michaelBraun,
  'e627e111-efd9-40aa-a334-c20cdd9e9e24': claudiaMeyer,
  '62f070d3-fe24-44c9-ab95-ff4e7243a35b': annaSchneider,
};

// Get avatar by employee ID, fallback to undefined
export const getAvatarById = (id: string): string | undefined => {
  return avatarMap[id];
};

// Name-based avatar lookup (for fallback)
export const avatarsByName: Record<string, string> = {
  'Andreas Braun': andreasBraun,
  'Kerstin Hartmann': kerstinHartmann,
  'Patrick Hofmann': patrickHofmann,
  'Daniel Klein': danielKlein,
  'Stefan Koch': stefanKoch,
  'Sebastian Köhler': sebastianKoehler,
  'Petra Krüger': petraKrueger,
  'Markus Lange': markusLange,
  'Jens Lehmann': jensLehmann,
  'Melanie Maier': melanieMaier,
  'Heike Meier': heikeMeier,
  'Nicole Neumann': nicoleNeumann,
  'Laura Richter': lauraRichter,
  'Anja Schmid': anjaSchmid,
  'Frank Schmitt': frankSchmitt,
  'Martin Schröder': martinSchroeder,
  'Maria Schulz': mariaSchulz,
  'Tobias Schulze': tobiasSchulze,
  'Christian Schwarz': christianSchwarz,
  'Monika Werner': monikaWerner,
  'Sandra Wolf': sandraWolf,
  'Sabine Zimmermann': sabineZimmermann,
  'Lisa Becker': lisaBecker,
  'Jan Hoffmann': janHoffmann,
  'Max Müller': maxMueller,
  'Thomas Schmidt': thomasSchmidt,
  'Alexander Wagner': alexanderWagner,
  'Sarah Fischer': sarahFischer,
  'Julia Weber': juliaWeber,
  'Michael Braun': michaelBraun,
  'Claudia Meyer': claudiaMeyer,
  'Anna Schneider': annaSchneider,
};

export const getAvatarByName = (firstName: string, lastName: string): string | undefined => {
  const fullName = `${firstName} ${lastName}`;
  return avatarsByName[fullName];
};
