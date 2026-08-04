CREATE TABLE "churches" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"jurisdiction" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" text PRIMARY KEY,
	"requester" text NOT NULL,
	"addressee" text NOT NULL,
	"status" text NOT NULL,
	"since" bigint,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hymns" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"composer" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"lyrics" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
-- Seed the church directory with real Orthodox parishes.
INSERT INTO "churches" ("id", "name", "jurisdiction", "city", "region", "description") VALUES
	('ch_stnicholas', 'St. Nicholas Antiochian Orthodox Cathedral', 'Antiochian Orthodox', 'Brooklyn', 'New York', 'Cathedral parish serving the Antiochian community with daily services and a large choir.'),
	('ch_holytrinity', 'Holy Trinity Greek Orthodox Church', 'Greek Orthodox', 'Chicago', 'Illinois', 'Vibrant Greek Orthodox parish known for its Byzantine chant and annual festival.'),
	('ch_stgeorge', 'St. George Coptic Orthodox Church', 'Coptic Orthodox', 'Jersey City', 'New Jersey', 'Coptic parish with an active youth ministry and Sunday school.'),
	('ch_annunciation', 'Annunciation Orthodox Cathedral', 'Greek Orthodox', 'Houston', 'Texas', 'Historic cathedral and community hub in the heart of the city.'),
	('ch_stmary', 'St. Mary Coptic Orthodox Church', 'Coptic Orthodox', 'Los Angeles', 'California', 'Coptic parish devoted to the Theotokos with iconography workshops.'),
	('ch_stvladimir', 'St. Vladimir Orthodox Seminary Chapel', 'Orthodox Church in America', 'Yonkers', 'New York', 'Seminary chapel forming clergy and offering theological education.'),
	('ch_holycross', 'Holy Cross Orthodox Monastery', 'Serbian Orthodox', 'Wayne', 'West Virginia', 'Monastic community offering retreats, prayer, and hospitality.'),
	('ch_stanthony', 'St. Anthony the Great Mission', 'Antiochian Orthodox', 'Tucson', 'Arizona', 'Growing mission parish welcoming inquirers and catechumens.'),
	('ch_theotokos', 'Theotokos of Axion Estin Chapel', 'Greek Orthodox', 'Portland', 'Oregon', 'Small chapel hosting womens retreats and midweek Vespers.'),
	('ch_stherman', 'St. Herman of Alaska Orthodox Church', 'Orthodox Church in America', 'Anchorage', 'Alaska', 'Parish honoring the enlightener of Alaska with a strong outreach ministry.'),
	('ch_stjohn', 'St. John the Baptist Greek Orthodox Church', 'Greek Orthodox', 'Boston', 'Massachusetts', 'College-town parish with a lively young-adult fellowship.'),
	('ch_stsophia', 'St. Sophia Ukrainian Orthodox Cathedral', 'Ukrainian Orthodox', 'Philadelphia', 'Pennsylvania', 'Ukrainian cathedral celebrated for its choir and festal liturgies.');
--> statement-breakpoint
-- Seed the hymn catalog with well-known Orthodox hymns.
INSERT INTO "hymns" ("id", "title", "composer", "tone", "lyrics") VALUES
	('hy_phoshilaron', 'O Gladsome Light (Phos Hilaron)', 'Ancient, Vespers', 'Tone 2', 'O gladsome light of the holy glory of the immortal Father, heavenly, holy, blessed Jesus Christ.'),
	('hy_agniparthene', 'Agni Parthene (O Pure Virgin)', 'St. Nektarios of Aegina', 'Melody by St. Nektarios', 'O Virgin pure, immaculate, O Lady Theotokos. Rejoice, O unwedded Bride!'),
	('hy_cherubic', 'The Cherubic Hymn', 'Divine Liturgy', 'Varies', 'Let us who mystically represent the Cherubim, and sing the thrice-holy hymn to the life-giving Trinity.'),
	('hy_axionestin', 'It Is Truly Meet (Axion Estin)', 'Divine Liturgy', 'Tone 8', 'It is truly meet to bless you, O Theotokos, ever-blessed and most pure, and the Mother of our God.'),
	('hy_paschal', 'Christ Is Risen (Paschal Troparion)', 'Pascha', 'Tone 5', 'Christ is risen from the dead, trampling down death by death, and upon those in the tombs bestowing life.'),
	('hy_trisagion', 'Trisagion (Holy God)', 'Divine Liturgy', 'Varies', 'Holy God, Holy Mighty, Holy Immortal, have mercy on us.'),
	('hy_doxology', 'The Great Doxology', 'Orthros', 'Tone 1', 'Glory to God in the highest, and on earth peace, good will among men.'),
	('hy_rejoicevirgin', 'Rejoice O Virgin Theotokos', 'Vigil', 'Tone 4', 'Rejoice, O Virgin Theotokos, Mary full of grace, the Lord is with you.'),
	('hy_letmyprayer', 'Let My Prayer Arise', 'Presanctified Liturgy', 'Tone 8', 'Let my prayer arise in your sight as incense, and the lifting up of my hands as an evening sacrifice.'),
	('hy_nowthepowers', 'Now the Powers of Heaven', 'Presanctified Liturgy', 'Varies', 'Now the powers of heaven do serve invisibly with us, for behold the King of Glory enters.'),
	('hy_underyourcompassion', 'Beneath Your Compassion', 'Ancient', 'Tone 5', 'Beneath your compassion we take refuge, O Theotokos; despise not our petitions in our distress.'),
	('hy_manyyears', 'Many Years (Eis Polla Eti)', 'Hierarchical Liturgy', 'Tone 8', 'Many years, O Master. Eis polla eti, despota.');
--> statement-breakpoint
-- Remove the demo feed/message content that earlier builds seeded into the
-- database. It was authored by hardcoded sample users that no longer exist, so
-- it is cleared here to leave only content created by real registered members.
DELETE FROM "posts" WHERE "id" IN ('p1', 'p2', 'p3', 'p4', 'p5');
--> statement-breakpoint
DELETE FROM "messages" WHERE "id" IN ('m1', 'm2', 'm3', 'm4', 'm5', 'm6');
