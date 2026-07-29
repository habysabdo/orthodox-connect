// Translation dictionaries for the OrthodoxConnect UI.
//
// Keys are flat, dot-namespaced strings. `t()` (see ./index.tsx) looks a key up
// in the active locale, falling back to English when a translation is missing,
// and finally to the raw key so nothing ever renders blank. Simple `{name}`
// placeholders are interpolated by `t()`.

export type LocaleCode = 'en' | 'ar' | 'el' | 'ru' | 'ro';

export interface LocaleMeta {
  code: LocaleCode;
  /** Native language name, shown in the switcher. */
  label: string;
  /** English name, for accessibility / secondary labels. */
  englishLabel: string;
  /** Text direction the whole document should adopt for this locale. */
  dir: 'ltr' | 'rtl';
  flag: string;
}

// Order here is the order shown in the language switcher.
export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', englishLabel: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', englishLabel: 'Arabic', dir: 'rtl', flag: '🇸🇦' },
  { code: 'el', label: 'Ελληνικά', englishLabel: 'Greek', dir: 'ltr', flag: '🇬🇷' },
  { code: 'ru', label: 'Русский', englishLabel: 'Russian', dir: 'ltr', flag: '🇷🇺' },
  { code: 'ro', label: 'Română', englishLabel: 'Romanian', dir: 'ltr', flag: '🇷🇴' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

type Dict = Record<string, string>;

const en: Dict = {
  // Navigation
  'nav.feed': 'Home Feed',
  'nav.reels': 'Reels',
  'nav.network': 'My Network',
  'nav.groups': 'Groups',
  'nav.messages': 'Messages',
  'nav.calendar': 'Calendar',
  'nav.profile': 'Profile',
  'nav.admin': 'Admin Panel',

  // Header / shell
  'header.goLive': 'Go Live',
  'header.openChats': 'Open chats & live',
  'header.broadcast': 'Broadcast to the community',

  // Share & invite
  'share.title': 'Share OrthodoxConnect',
  'share.invite': 'Invite Friends',
  'share.subtitle': 'Grow the fellowship',
  'share.scanHint': 'Scan with your phone camera to download & install OrthodoxConnect.',
  'share.copyLink': 'Copy App Link',
  'share.copied': 'Link copied!',
  'share.shareMobile': 'Share via Mobile',
  'share.nativeText': 'Join me on OrthodoxConnect — faith, fellowship and community.',

  // Common actions
  'common.cancel': 'Cancel',
  'common.save': 'Save changes',
  'common.signOut': 'Sign out',
  'common.admin': 'Admin',

  // Profile
  'profile.editProfile': 'Edit profile',
  'profile.adminOwner': 'Admin / Owner',
  'profile.noParishSet': 'No parish set',
  'profile.noParish': 'No parish',
  'profile.age': 'Age {age}',
  'profile.joined': 'Joined {time} ago',
  'profile.connections': 'Connections',
  'profile.posts': 'Posts',
  'profile.events': 'Events',
  'profile.yourPosts': 'Your posts',
  'profile.noPosts': 'You haven’t posted yet.',
  'profile.editTitle': 'Edit profile',
  'profile.changePhoto': 'Change photo',
  'profile.fullName': 'Full name',
  'profile.parish': 'Parish',
  'profile.parishPlaceholder': 'Type your church or parish',
  'profile.bio': 'Bio',
  'profile.bioPlaceholder': 'A line about yourself…',

  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageDesc': 'Choose the language for menus, buttons, and system text.',

  // Install / PWA
  'install.title': 'Install OrthodoxConnect',
  'install.body': 'Add the app to your home screen for a faster, full-screen experience.',
  'install.button': 'Install App',
  'install.dismiss': 'Not now',
  'installBanner.cta': 'Install OrthodoxConnect App',
  'installBanner.subtitle': 'Add to your home screen — full-screen, works offline.',
  'installModal.title': 'Install OrthodoxConnect',
  'installModal.subtitle': 'A few taps adds the app to your home screen.',
  'installModal.yourDevice': 'Your device',
  'installModal.iosTitle': 'iPhone & iPad (Safari)',
  'installModal.iosStep1': 'Tap the Share button in Safari’s toolbar.',
  'installModal.iosStep2': 'Choose “Add to Home Screen”.',
  'installModal.iosStep3': 'Tap “Add” — the icon appears on your home screen.',
  'installModal.androidTitle': 'Android (Chrome)',
  'installModal.androidStep1': 'Open the browser menu (⋮).',
  'installModal.androidStep2': 'Tap “Install app” or “Add to Home screen”.',
  'installModal.androidStep3': 'Confirm to finish installing.',
  'installModal.close': 'Close',
};

const ar: Dict = {
  'nav.feed': 'الصفحة الرئيسية',
  'nav.reels': 'المقاطع',
  'nav.network': 'شبكتي',
  'nav.groups': 'المجموعات',
  'nav.messages': 'الرسائل',
  'nav.calendar': 'التقويم',
  'nav.profile': 'الملف الشخصي',
  'nav.admin': 'لوحة الإدارة',

  'header.goLive': 'بث مباشر',
  'header.openChats': 'فتح المحادثات والبث المباشر',
  'header.broadcast': 'بث للمجتمع',

  'common.cancel': 'إلغاء',
  'common.save': 'حفظ التغييرات',
  'common.signOut': 'تسجيل الخروج',
  'common.admin': 'مشرف',

  'profile.editProfile': 'تعديل الملف الشخصي',
  'profile.adminOwner': 'مشرف / مالك',
  'profile.noParishSet': 'لم يتم تحديد الأبرشية',
  'profile.noParish': 'لا توجد أبرشية',
  'profile.age': 'العمر {age}',
  'profile.joined': 'انضم منذ {time}',
  'profile.connections': 'الاتصالات',
  'profile.posts': 'المنشورات',
  'profile.events': 'الفعاليات',
  'profile.yourPosts': 'منشوراتك',
  'profile.noPosts': 'لم تنشر شيئًا بعد.',
  'profile.editTitle': 'تعديل الملف الشخصي',
  'profile.changePhoto': 'تغيير الصورة',
  'profile.fullName': 'الاسم الكامل',
  'profile.parish': 'الأبرشية',
  'profile.parishPlaceholder': 'اكتب اسم كنيستك أو أبرشيتك',
  'profile.bio': 'نبذة',
  'profile.bioPlaceholder': 'سطر عن نفسك…',

  'settings.title': 'الإعدادات',
  'settings.language': 'اللغة',
  'settings.languageDesc': 'اختر لغة القوائم والأزرار ونصوص النظام.',

  'install.title': 'ثبّت تطبيق OrthodoxConnect',
  'install.body': 'أضف التطبيق إلى شاشتك الرئيسية لتجربة أسرع وبملء الشاشة.',
  'install.button': 'تثبيت التطبيق',
  'install.dismiss': 'ليس الآن',
  'installBanner.cta': 'ثبّت تطبيق OrthodoxConnect',
  'installBanner.subtitle': 'أضِفه إلى شاشتك الرئيسية — ملء الشاشة ويعمل دون اتصال.',
  'installModal.title': 'تثبيت OrthodoxConnect',
  'installModal.subtitle': 'نقرات قليلة تضيف التطبيق إلى شاشتك الرئيسية.',
  'installModal.yourDevice': 'جهازك',
  'installModal.iosTitle': 'آيفون وآيباد (Safari)',
  'installModal.iosStep1': 'اضغط على زر المشاركة في شريط أدوات Safari.',
  'installModal.iosStep2': 'اختر «إضافة إلى الشاشة الرئيسية».',
  'installModal.iosStep3': 'اضغط «إضافة» — ستظهر الأيقونة على شاشتك الرئيسية.',
  'installModal.androidTitle': 'أندرويد (Chrome)',
  'installModal.androidStep1': 'افتح قائمة المتصفح (⋮).',
  'installModal.androidStep2': 'اضغط «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
  'installModal.androidStep3': 'أكِّد لإتمام التثبيت.',
  'installModal.close': 'إغلاق',
};

const el: Dict = {
  'nav.feed': 'Αρχική Ροή',
  'nav.reels': 'Reels',
  'nav.network': 'Το Δίκτυό μου',
  'nav.groups': 'Ομάδες',
  'nav.messages': 'Μηνύματα',
  'nav.calendar': 'Ημερολόγιο',
  'nav.profile': 'Προφίλ',
  'nav.admin': 'Πίνακας Διαχείρισης',

  'header.goLive': 'Ζωντανά',
  'header.openChats': 'Άνοιγμα συνομιλιών & ζωντανών',
  'header.broadcast': 'Μετάδοση στην κοινότητα',

  'common.cancel': 'Άκυρο',
  'common.save': 'Αποθήκευση αλλαγών',
  'common.signOut': 'Αποσύνδεση',
  'common.admin': 'Διαχειριστής',

  'profile.editProfile': 'Επεξεργασία προφίλ',
  'profile.adminOwner': 'Διαχειριστής / Ιδιοκτήτης',
  'profile.noParishSet': 'Δεν έχει οριστεί ενορία',
  'profile.noParish': 'Καμία ενορία',
  'profile.age': 'Ηλικία {age}',
  'profile.joined': 'Εγγράφηκε πριν από {time}',
  'profile.connections': 'Συνδέσεις',
  'profile.posts': 'Δημοσιεύσεις',
  'profile.events': 'Εκδηλώσεις',
  'profile.yourPosts': 'Οι δημοσιεύσεις σας',
  'profile.noPosts': 'Δεν έχετε δημοσιεύσει ακόμη.',
  'profile.editTitle': 'Επεξεργασία προφίλ',
  'profile.changePhoto': 'Αλλαγή φωτογραφίας',
  'profile.fullName': 'Ονοματεπώνυμο',
  'profile.parish': 'Ενορία',
  'profile.parishPlaceholder': 'Πληκτρολογήστε την εκκλησία ή ενορία σας',
  'profile.bio': 'Βιογραφικό',
  'profile.bioPlaceholder': 'Μια γραμμή για εσάς…',

  'settings.title': 'Ρυθμίσεις',
  'settings.language': 'Γλώσσα',
  'settings.languageDesc': 'Επιλέξτε τη γλώσσα για μενού, κουμπιά και κείμενα συστήματος.',

  'install.title': 'Εγκατάσταση OrthodoxConnect',
  'install.body': 'Προσθέστε την εφαρμογή στην αρχική οθόνη για ταχύτερη εμπειρία πλήρους οθόνης.',
  'install.button': 'Εγκατάσταση',
  'install.dismiss': 'Όχι τώρα',
  'installBanner.cta': 'Εγκατάσταση εφαρμογής OrthodoxConnect',
  'installBanner.subtitle': 'Προσθέστε την στην αρχική οθόνη — πλήρης οθόνη, λειτουργεί εκτός σύνδεσης.',
  'installModal.title': 'Εγκατάσταση OrthodoxConnect',
  'installModal.subtitle': 'Με λίγα πατήματα προσθέτετε την εφαρμογή στην αρχική οθόνη.',
  'installModal.yourDevice': 'Η συσκευή σας',
  'installModal.iosTitle': 'iPhone & iPad (Safari)',
  'installModal.iosStep1': 'Πατήστε το κουμπί Κοινοποίηση στη γραμμή του Safari.',
  'installModal.iosStep2': 'Επιλέξτε «Προσθήκη στην αρχική οθόνη».',
  'installModal.iosStep3': 'Πατήστε «Προσθήκη» — το εικονίδιο εμφανίζεται στην αρχική οθόνη.',
  'installModal.androidTitle': 'Android (Chrome)',
  'installModal.androidStep1': 'Ανοίξτε το μενού του προγράμματος περιήγησης (⋮).',
  'installModal.androidStep2': 'Πατήστε «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».',
  'installModal.androidStep3': 'Επιβεβαιώστε για να ολοκληρωθεί η εγκατάσταση.',
  'installModal.close': 'Κλείσιμο',
};

const ru: Dict = {
  'nav.feed': 'Лента',
  'nav.reels': 'Клипы',
  'nav.network': 'Моя сеть',
  'nav.groups': 'Группы',
  'nav.messages': 'Сообщения',
  'nav.calendar': 'Календарь',
  'nav.profile': 'Профиль',
  'nav.admin': 'Панель администратора',

  'header.goLive': 'В эфир',
  'header.openChats': 'Открыть чаты и эфиры',
  'header.broadcast': 'Трансляция для сообщества',

  'common.cancel': 'Отмена',
  'common.save': 'Сохранить изменения',
  'common.signOut': 'Выйти',
  'common.admin': 'Администратор',

  'profile.editProfile': 'Редактировать профиль',
  'profile.adminOwner': 'Администратор / Владелец',
  'profile.noParishSet': 'Приход не указан',
  'profile.noParish': 'Нет прихода',
  'profile.age': 'Возраст {age}',
  'profile.joined': 'Присоединился {time} назад',
  'profile.connections': 'Связи',
  'profile.posts': 'Публикации',
  'profile.events': 'События',
  'profile.yourPosts': 'Ваши публикации',
  'profile.noPosts': 'Вы ещё ничего не опубликовали.',
  'profile.editTitle': 'Редактировать профиль',
  'profile.changePhoto': 'Изменить фото',
  'profile.fullName': 'Полное имя',
  'profile.parish': 'Приход',
  'profile.parishPlaceholder': 'Введите вашу церковь или приход',
  'profile.bio': 'О себе',
  'profile.bioPlaceholder': 'Строка о себе…',

  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.languageDesc': 'Выберите язык для меню, кнопок и системного текста.',

  'install.title': 'Установить OrthodoxConnect',
  'install.body': 'Добавьте приложение на главный экран для более быстрой полноэкранной работы.',
  'install.button': 'Установить',
  'install.dismiss': 'Не сейчас',
  'installBanner.cta': 'Установить приложение OrthodoxConnect',
  'installBanner.subtitle': 'Добавьте на главный экран — во весь экран, работает офлайн.',
  'installModal.title': 'Установить OrthodoxConnect',
  'installModal.subtitle': 'Несколько нажатий — и приложение на главном экране.',
  'installModal.yourDevice': 'Ваше устройство',
  'installModal.iosTitle': 'iPhone и iPad (Safari)',
  'installModal.iosStep1': 'Нажмите кнопку «Поделиться» на панели Safari.',
  'installModal.iosStep2': 'Выберите «На экран «Домой»».',
  'installModal.iosStep3': 'Нажмите «Добавить» — значок появится на главном экране.',
  'installModal.androidTitle': 'Android (Chrome)',
  'installModal.androidStep1': 'Откройте меню браузера (⋮).',
  'installModal.androidStep2': 'Нажмите «Установить приложение» или «Добавить на главный экран».',
  'installModal.androidStep3': 'Подтвердите, чтобы завершить установку.',
  'installModal.close': 'Закрыть',
};

const ro: Dict = {
  'nav.feed': 'Flux principal',
  'nav.reels': 'Reels',
  'nav.network': 'Rețeaua mea',
  'nav.groups': 'Grupuri',
  'nav.messages': 'Mesaje',
  'nav.calendar': 'Calendar',
  'nav.profile': 'Profil',
  'nav.admin': 'Panou de administrare',

  'header.goLive': 'Transmite live',
  'header.openChats': 'Deschide conversații și live',
  'header.broadcast': 'Transmite către comunitate',

  'common.cancel': 'Anulează',
  'common.save': 'Salvează modificările',
  'common.signOut': 'Deconectare',
  'common.admin': 'Administrator',

  'profile.editProfile': 'Editează profilul',
  'profile.adminOwner': 'Administrator / Proprietar',
  'profile.noParishSet': 'Nicio parohie setată',
  'profile.noParish': 'Fără parohie',
  'profile.age': 'Vârsta {age}',
  'profile.joined': 'S-a alăturat acum {time}',
  'profile.connections': 'Conexiuni',
  'profile.posts': 'Postări',
  'profile.events': 'Evenimente',
  'profile.yourPosts': 'Postările tale',
  'profile.noPosts': 'Nu ai postat încă nimic.',
  'profile.editTitle': 'Editează profilul',
  'profile.changePhoto': 'Schimbă poza',
  'profile.fullName': 'Nume complet',
  'profile.parish': 'Parohie',
  'profile.parishPlaceholder': 'Scrie biserica sau parohia ta',
  'profile.bio': 'Descriere',
  'profile.bioPlaceholder': 'Un rând despre tine…',

  'settings.title': 'Setări',
  'settings.language': 'Limbă',
  'settings.languageDesc': 'Alege limba pentru meniuri, butoane și textul sistemului.',

  'install.title': 'Instalează OrthodoxConnect',
  'install.body': 'Adaugă aplicația pe ecranul de start pentru o experiență mai rapidă, pe tot ecranul.',
  'install.button': 'Instalează aplicația',
  'install.dismiss': 'Nu acum',
  'installBanner.cta': 'Instalează aplicația OrthodoxConnect',
  'installBanner.subtitle': 'Adaug-o pe ecranul de start — pe tot ecranul, funcționează offline.',
  'installModal.title': 'Instalează OrthodoxConnect',
  'installModal.subtitle': 'Câteva atingeri adaugă aplicația pe ecranul de start.',
  'installModal.yourDevice': 'Dispozitivul tău',
  'installModal.iosTitle': 'iPhone și iPad (Safari)',
  'installModal.iosStep1': 'Atinge butonul Partajare din bara Safari.',
  'installModal.iosStep2': 'Alege „Adaugă la ecranul principal”.',
  'installModal.iosStep3': 'Atinge „Adaugă” — pictograma apare pe ecranul de start.',
  'installModal.androidTitle': 'Android (Chrome)',
  'installModal.androidStep1': 'Deschide meniul browserului (⋮).',
  'installModal.androidStep2': 'Atinge „Instalează aplicația” sau „Adaugă la ecranul principal”.',
  'installModal.androidStep3': 'Confirmă pentru a finaliza instalarea.',
  'installModal.close': 'Închide',
};

export const TRANSLATIONS: Record<LocaleCode, Dict> = { en, ar, el, ru, ro };
