import {
  ADMIN_EMAIL,
  type CalendarEvent,
  type ChatMessage,
  type CommunityAlert,
  type Friendship,
  type LiveStream,
  type Post,
  type Thread,
  type User,
} from '../types';

const now = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Deterministic avatar helper using Pexels portrait stock photos.
const avatar = (seed: number) =>
  [
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg',
    'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg',
    'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg',
    'https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg',
    'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg',
    'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg',
    'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
    'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg',
    'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg',
  ][seed % 10];

export const seedUsers: User[] = [
  {
    id: 'u_admin',
    email: ADMIN_EMAIL,
    name: 'Lucas Admin',
    age: 34,
    photo: avatar(0),
    parish: 'St. Nicholas Antiochian Orthodox Cathedral',
    role: 'admin',
    bio: 'Servant & community steward. Building OrthodoxConnect to knit our parishes together.',
    joinedAt: now - 120 * DAY,
    onboarded: true,
    online: true,
  },
  {
    id: 'u_michael',
    email: 'michael.khalil@example.com',
    name: 'Michael Khalil',
    age: 28,
    photo: avatar(1),
    parish: 'St. George Coptic Orthodox Church',
    role: 'member',
    bio: 'Cantor & youth servant. Coffee, chant, repeat.',
    joinedAt: now - 90 * DAY,
    onboarded: true,
    online: true,
  },
  {
    id: 'u_maria',
    email: 'maria.haddad@example.com',
    name: 'Maria Haddad',
    age: 25,
    photo: avatar(2),
    parish: 'St. Mary Coptic Orthodox Church',
    role: 'member',
    bio: 'Iconographer in training. Glory to God.',
    joinedAt: now - 80 * DAY,
    onboarded: true,
    online: true,
  },
  {
    id: 'u_peter',
    email: 'peter.georgiou@example.com',
    name: 'Peter Georgiou',
    age: 41,
    photo: avatar(3),
    parish: 'Annunciation Orthodox Cathedral',
    role: 'member',
    bio: 'Parish council & father of three.',
    joinedAt: now - 70 * DAY,
    onboarded: true,
    online: false,
  },
  {
    id: 'u_elena',
    email: 'elena.samaras@example.com',
    name: 'Eena Samaras',
    age: 31,
    photo: avatar(4),
    parish: 'Holy Trinity Greek Orthodox Church',
    role: 'member',
    bio: 'Sunday school teacher. Philoptochos volunteer.',
    joinedAt: now - 60 * DAY,
    onboarded: true,
    online: true,
  },
  {
    id: 'u_daniel',
    email: 'daniel.yacoub@example.com',
    name: 'Daniel Yacoub',
    age: 22,
    photo: avatar(5),
    parish: 'St. Anthony the Great Mission',
    role: 'member',
    bio: 'Theology student. Aspiring deacon.',
    joinedAt: now - 45 * DAY,
    onboarded: true,
    online: false,
  },
  {
    id: 'u_sophia',
    email: 'sophia.angelos@example.com',
    name: 'Sophia Angelos',
    age: 27,
    photo: avatar(6),
    parish: 'St. Sophia Ukrainian Orthodox Cathedral',
    role: 'member',
    bio: 'Choir director. Byzantine chant enthusiast.',
    joinedAt: now - 30 * DAY,
    onboarded: true,
    online: true,
  },
  {
    id: 'u_andrew',
    email: 'andrew.makari@example.com',
    name: 'Andrew Makari',
    age: 36,
    photo: avatar(7),
    parish: 'St. Herman of Alaska Orthodox Church',
    role: 'member',
    bio: 'Software engineer who built a parish app.',
    joinedAt: now - 14 * DAY,
    onboarded: true,
    online: true,
  },
  {
    id: 'u_theresa',
    email: 'theresa.boutros@example.com',
    name: 'Theresa Boutros',
    age: 52,
    photo: avatar(8),
    parish: 'Theotokos of Axion Estin Chapel',
    role: 'member',
    bio: 'Khouriya. Hosting a women’s retreat this fall.',
    joinedAt: now - 7 * DAY,
    onboarded: true,
    online: false,
  },
  {
    id: 'u_justin',
    email: 'justin.saad@example.com',
    name: 'Justin Saad',
    age: 19,
    photo: avatar(9),
    parish: 'St. John the Baptist Greek Orthodox Church',
    role: 'member',
    bio: 'College freshman. Looking for a home parish.',
    joinedAt: now - 2 * DAY,
    onboarded: true,
    online: true,
  },
];

export const seedFriendships: Friendship[] = [
  { id: 'f_a_m', a: 'u_admin', b: 'u_michael', status: 'accepted', since: now - 100 * DAY },
  { id: 'f_a_ma', a: 'u_admin', b: 'u_maria', status: 'accepted', since: now - 95 * DAY },
  { id: 'f_a_p', a: 'u_admin', b: 'u_peter', status: 'accepted', since: now - 90 * DAY },
  { id: 'f_a_e', a: 'u_admin', b: 'u_elena', status: 'accepted', since: now - 80 * DAY },
  { id: 'f_a_d', a: 'u_admin', b: 'u_daniel', status: 'incoming', since: now - 1 * DAY },
  { id: 'f_m_ma', a: 'u_michael', b: 'u_maria', status: 'accepted', since: now - 60 * DAY },
  { id: 'f_m_s', a: 'u_michael', b: 'u_sophia', status: 'accepted', since: now - 40 * DAY },
  { id: 'f_m_an', a: 'u_michael', b: 'u_andrew', status: 'accepted', since: now - 30 * DAY },
  { id: 'f_e_p', a: 'u_elena', b: 'u_peter', status: 'accepted', since: now - 50 * DAY },
  { id: 'f_s_d', a: 'u_sophia', b: 'u_daniel', status: 'accepted', since: now - 20 * DAY },
  { id: 'f_t_e', a: 'u_theresa', b: 'u_elena', status: 'accepted', since: now - 10 * DAY },
  { id: 'f_j_d', a: 'u_justin', b: 'u_daniel', status: 'outgoing', since: now - 6 * HOUR },
  // suggestions aimed at admin
  { id: 'f_a_t', a: 'u_admin', b: 'u_theresa', status: 'outgoing', since: now - 5 * HOUR },
  { id: 'f_a_s', a: 'u_admin', b: 'u_sophia', status: 'none' },
  { id: 'f_a_an', a: 'u_admin', b: 'u_andrew', status: 'none' },
  { id: 'f_a_j', a: 'u_admin', b: 'u_justin', status: 'none' },
];

export const seedPosts: Post[] = [
  {
    id: 'p1',
    authorId: 'u_michael',
    text: 'Just finished Vespers. There is nothing like the silence after “O Gladsome Light.” May your evening be blessed.',
    image: 'https://images.pexels.com/photos/2014773/pexels-photo-2014773.jpeg',
    createdAt: now - 3 * HOUR,
    likes: ['u_admin', 'u_maria', 'u_sophia', 'u_daniel'],
    comments: [
      { id: 'c1', authorId: 'u_maria', text: 'Amen! That hymn always moves me.', createdAt: now - 2.5 * HOUR },
      { id: 'c2', authorId: 'u_sophia', text: 'We sang it in Arabic and English tonight. Beautiful.', createdAt: now - 2 * HOUR },
    ],
  },
  {
    id: 'p2',
    authorId: 'u_elena',
    text: 'Philoptochos bake sale raised $2,400 for the refugee fund! Thank you to every hand that kneaded and every mouth that bought. Glory to God.',
    image: 'https://images.pexels.com/photos/2065891/pexels-photo-2065891.jpeg',
    createdAt: now - 8 * HOUR,
    likes: ['u_admin', 'u_peter', 'u_theresa', 'u_maria', 'u_michael'],
    comments: [
      { id: 'c3', authorId: 'u_theresa', text: 'Proud of you all. May it be multiplied.', createdAt: now - 6 * HOUR },
      { id: 'c4', authorId: 'u_admin', text: 'Incredible work, Elena!', createdAt: now - 5 * HOUR },
    ],
  },
  {
    id: 'p3',
    authorId: 'u_daniel',
    text: 'Question for the group: how do you balance keeping the fast as a college student on a meal plan? Honest struggles welcome.',
    createdAt: now - 14 * HOUR,
    likes: ['u_sophia', 'u_michael', 'u_justin'],
    comments: [
      { id: 'c5', authorId: 'u_justin', text: 'Same boat. I keep peanut butter and lentils in my dorm.', createdAt: now - 12 * HOUR },
      { id: 'c6', authorId: 'u_michael', text: 'The fast is a tool, not a whip. Talk to your father confessor.', createdAt: now - 10 * HOUR },
    ],
  },
  {
    id: 'p4',
    authorId: 'u_sophia',
    text: 'Choir rehearsal tonight — working on the Cherubic Hymn in tone 5. Anyone in the area is welcome to sit in.',
    image: 'https://images.pexels.com/photos/164743/pexels-photo-164743.jpeg',
    createdAt: now - 26 * HOUR,
    likes: ['u_admin', 'u_elena', 'u_maria'],
    comments: [
      { id: 'c7', authorId: 'u_elena', text: 'I might come listen!', createdAt: now - 20 * HOUR },
    ],
  },
  {
    id: 'p5',
    authorId: 'u_theresa',
    text: 'Registration is open for the women’s retreat. Theme: “The Myrrh-bearing Women.” Reach out if you need a scholarship — no one turned away.',
    createdAt: now - 2 * DAY,
    likes: ['u_admin', 'u_elena', 'u_maria', 'u_sophia', 'u_peter'],
    comments: [
      { id: 'c8', authorId: 'u_maria', text: 'Registering today.', createdAt: now - 1.5 * DAY },
      { id: 'c9', authorId: 'u_admin', text: 'Sticky-posting this to the community alert.', createdAt: now - 1.2 * DAY },
    ],
  },
];

export const seedThreads: Thread[] = [
  {
    id: 't_admin_michael',
    participantIds: ['u_admin', 'u_michael'],
    messages: [
      { id: 'm1', threadId: 't_admin_michael', senderId: 'u_michael', text: 'Father, are you going live for Bible study tonight?', createdAt: now - 5 * HOUR, read: true },
      { id: 'm2', threadId: 't_admin_michael', senderId: 'u_admin', text: 'Yes — 8pm sharp. Tagging it “Wednesday Bible Study”.', createdAt: now - 4.8 * HOUR, read: true },
      { id: 'm3', threadId: 't_admin_michael', senderId: 'u_michael', text: 'Perfect, I’ll share it in the youth group chat.', createdAt: now - 4.5 * HOUR, read: false },
    ],
  },
  {
    id: 't_admin_maria',
    participantIds: ['u_admin', 'u_maria'],
    messages: [
      { id: 'm4', threadId: 't_admin_maria', senderId: 'u_maria', text: 'I finished the icon of St. Mary. Want to see?', createdAt: now - 2 * HOUR, read: false },
    ],
  },
  {
    id: 't_admin_elena',
    participantIds: ['u_admin', 'u_elena'],
    messages: [
      { id: 'm5', threadId: 't_admin_elena', senderId: 'u_elena', text: 'Thank you for sharing the bake sale post! 💛', createdAt: now - 7 * HOUR, read: true },
      { id: 'm6', threadId: 't_admin_elena', senderId: 'u_admin', text: 'Of course — what a blessing.', createdAt: now - 6.8 * HOUR, read: true },
    ],
  },
];

export const seedLiveStream: LiveStream = {
  id: 'live_seed',
  hostId: 'u_michael',
  title: 'Wednesday Bible Study — The Epistle to the Romans',
  startedAt: now - 18 * MIN,
  viewers: 14,
  viewerIds: ['u_maria', 'u_sophia', 'u_daniel'],
  active: true,
  kind: 'seed',
  chat: [
    { id: 'lc1', streamId: 'live_seed', senderId: 'u_maria', text: 'Glory to God — joined!', createdAt: now - 17 * MIN },
    { id: 'lc2', streamId: 'live_seed', senderId: 'u_sophia', text: 'The acoustics in your church are lovely.', createdAt: now - 12 * MIN },
    { id: 'lc3', streamId: 'live_seed', senderId: 'u_daniel', text: 'Can you repeat the verse reference?', createdAt: now - 4 * MIN },
    { id: 'lc4', streamId: 'live_seed', senderId: 'u_michael', text: 'Romans 8:28 — “All things work together for good.”', createdAt: now - 3 * MIN },
  ],
};

export const seedEvents: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Sunday Divine Liturgy',
    parish: 'St. Nicholas Antiochian Orthodox Cathedral',
    date: isoDate(now + 2 * DAY),
    time: '09:30',
    location: 'Main Sanctuary',
    description: 'Divine Liturgy of St. John Chrysostom. Coffee hour follows.',
    createdBy: 'u_admin',
  },
  {
    id: 'e2',
    title: 'Women’s Retreat: The Myrrh-bearing Women',
    parish: 'Theotokos of Axion Estin Chapel',
    date: isoDate(now + 9 * DAY),
    time: '10:00',
    location: 'Chapel Hall',
    description: 'A day of teaching, prayer, and fellowship. Lunch provided.',
    createdBy: 'u_theresa',
  },
  {
    id: 'e3',
    title: 'Youth Group Bonfire',
    parish: 'St. George Coptic Orthodox Church',
    date: isoDate(now + 5 * DAY),
    time: '18:30',
    location: 'Church Lawn',
    description: 'High school & college group. Marshmallows and chant.',
    createdBy: 'u_michael',
  },
  {
    id: 'e4',
    title: 'Parish Council Meeting',
    parish: 'Annunciation Orthodox Cathedral',
    date: isoDate(now + 7 * DAY),
    time: '19:00',
    location: 'Fellowship Hall',
    description: 'Monthly council meeting. All parishioners welcome to observe.',
    createdBy: 'u_peter',
  },
];

export const seedAlerts: CommunityAlert[] = [
  {
    id: 'a1',
    title: 'Welcome to OrthodoxConnect',
    body: 'A private space for our parishes to fellowship, share, and pray together. Invite a friend from your church!',
    level: 'info',
    createdAt: now - 5 * DAY,
    createdBy: 'u_admin',
  },
  {
    id: 'a2',
    title: 'Fasting season begins next week',
    body: 'The Dormition Fast begins August 1. Share your recipes and reflections with the community.',
    level: 'info',
    createdAt: now - 1 * DAY,
    createdBy: 'u_admin',
  },
];

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
