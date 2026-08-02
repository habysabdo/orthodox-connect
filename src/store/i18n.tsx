import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ar';

type Dict = Record<string, string>;

const en: Dict = {
  'nav.feed': 'Home Feed',
  'nav.reels': 'Reels',
  'nav.network': 'My Network',
  'nav.messages': 'Messages',
  'nav.calendar': 'Calendar',
  'nav.profile': 'Profile',
  'nav.admin': 'Admin Panel',
  'nav.signOut': 'Sign out',
  'nav.goLive': 'Go Live',
  'nav.upload': 'Upload',
  'nav.broadcast': 'Broadcast to the community',
  'nav.share': 'Share a video or photo',
  'nav.theme': 'Theme',
  'nav.language': 'Language',
  'nav.dark': 'Dark',
  'nav.light': 'Light',
  'nav.ancient': 'Ancient',
  'nav.noParish': 'No parish',

  'common.follow': 'Follow',
  'common.following': 'Following',
  'common.unfollow': 'Unfollow',
  'common.message': 'Message',
  'common.call': 'Call',
  'common.cancel': 'Cancel',
  'common.save': 'Save changes',
  'common.send': 'Send',
  'common.loading': 'Loading...',
  'common.uploading': 'Uploading...',
  'common.postToFeed': 'Post to feed',
  'common.joinRoom': 'Join Room',
  'common.remove': 'Remove connection',
  'common.suggested': 'Suggested',
  'common.pending': 'Pending',

  'network.title': 'My Network',
  'network.connections': 'connections',
  'network.suggested': 'Suggested for you',
  'network.yourConnections': 'Your connections',
  'network.groupRooms': 'Group Video Rooms',
  'network.joined': 'joined',
  'network.noConnections': 'No connections yet',
  'network.noConnectionsSub': 'Follow people from the suggestions above to build your parish network.',

  'reels.like': 'Like',
  'reels.comment': 'Comment',
  'reels.share': 'Share',
  'reels.save': 'Save',
  'reels.addComment': 'Add a comment...',
  'reels.beFirst': 'Be the first to comment.',
  'reels.comments': 'Comments',

  'stories.title': 'Stories',
  'stories.yourStory': 'Your story',
  'stories.reply': 'Reply',

  'upload.title': 'Upload Video or Photo',
  'upload.tap': 'Tap to upload a video or photo',
  'upload.formats': 'MP4, MOV, JPG, PNG',
  'upload.caption': 'Caption',
  'upload.captionPlaceholder': 'Write a caption...',
  'upload.hashtags': 'Hashtags',
  'upload.addHashtag': 'Add a hashtag...',
  'upload.add': 'Add',

  'profile.edit': 'Edit profile',
  'profile.fullName': 'Full name',
  'profile.parish': 'Parish',
  'profile.bio': 'Bio',
  'profile.bioPlaceholder': 'A line about yourself...',
  'profile.posts': 'Posts',
  'profile.saved': 'Saved',
  'profile.liked': 'Liked',
  'profile.followers': 'Followers',
  'profile.following': 'Following',
  'profile.events': 'Events',
  'profile.connections': 'Connections',
  'profile.changePhoto': 'Change photo',

  'messenger.title': 'Messages',
  'messenger.unread': 'unread',
  'messenger.selectConv': 'Select a conversation',
  'messenger.selectSub': 'Pick a friend on the left to view your message history.',
  'messenger.typePlaceholder': 'Type a message...',
  'messenger.activeNow': 'Active now',
  'messenger.offline': 'Offline',
  'messenger.sayHello': 'Say hello to',
  'messenger.startConv': 'Start the conversation',
  'messenger.noConversations': 'No conversations yet. Add friends to start messaging.',
  'messenger.sentPhoto': 'Sent a photo',
  'messenger.voiceMessage': 'Voice message',

  'call.participants': 'participant',
  'call.participantsPl': 'participants',
  'call.speaking': 'Speaking',
  'call.mute': 'Mute',
  'call.unmute': 'Unmute',
  'call.startVideo': 'Start video',
  'call.stopVideo': 'Stop video',
  'call.share': 'Share',
  'call.raiseHand': 'Raise hand',

  'landing.welcome': 'Welcome to OrthodoxConnect',
  'landing.signIn': 'Sign in to join your parish community.',
  'landing.continueGoogle': 'Continue with Google',
  'landing.connecting': 'Connecting...',
  'landing.hero1': 'Where the',
  'landing.hero2': 'parish',
  'landing.hero3': 'meets the',
  'landing.hero4': 'network',
  'landing.heroDesc': 'Connect with Orthodox Christians across parishes. Share your life, message your friends, join live Bible studies, and never miss a Sunday.',
  'landing.tagline': 'The social home for the Orthodox faithful',
  'landing.fellowship': 'Fellowship',
  'landing.goLive': 'Go Live',
  'landing.stayClose': 'Stay close',
  'landing.private': 'Private community',
  'landing.privacy': 'A private network for the Orthodox faithful — built for fellowship, not for the algorithm.',
  'landing.terms': 'Terms of Service',
  'landing.privacyPolicy': 'Privacy Policy',
  'landing.byContinue': 'By continuing you agree to our',
  'landing.and': 'and',
  'landing.footer': 'OrthodoxConnect · A demonstration build · Not affiliated with any specific jurisdiction',
};

const ar: Dict = {
  'nav.feed': 'الرئيسية',
  'nav.reels': 'الفيديوهات',
  'nav.network': 'شبكتي',
  'nav.messages': 'الرسائل',
  'nav.calendar': 'التقويم',
  'nav.profile': 'الملف الشخصي',
  'nav.admin': 'لوحة الإدارة',
  'nav.signOut': 'تسجيل الخروج',
  'nav.goLive': 'بث مباشر',
  'nav.upload': 'رفع',
  'nav.broadcast': 'بث للمجتمع',
  'nav.share': 'شارك فيديو أو صورة',
  'nav.theme': 'السمة',
  'nav.language': 'اللغة',
  'nav.dark': 'داكن',
  'nav.light': 'فاتح',
  'nav.ancient': 'قديم',
  'nav.noParish': 'لا كنيسة',

  'common.follow': 'متابعة',
  'common.following': 'تتابعه',
  'common.unfollow': 'إلغاء المتابعة',
  'common.message': 'رسالة',
  'common.call': 'اتصال',
  'common.cancel': 'إلغاء',
  'common.save': 'حفظ التغييرات',
  'common.send': 'إرسال',
  'common.loading': 'جارٍ التحميل...',
  'common.uploading': 'جارٍ الرفع...',
  'common.postToFeed': 'نشر',
  'common.joinRoom': 'انضم',
  'common.remove': 'إزالة',
  'common.suggested': 'مقترح',
  'common.pending': 'قيد الانتظار',

  'network.title': 'شبكتي',
  'network.connections': 'اتصالات',
  'network.suggested': 'مقترح لك',
  'network.yourConnections': 'اتصالاتك',
  'network.groupRooms': 'غرف الفيديو الجماعية',
  'network.joined': 'انضم',
  'network.noConnections': 'لا توجد اتصالات بعد',
  'network.noConnectionsSub': 'تابع أشخاصاً من المقترحات أعلاه لبناء شبكتك.',

  'reels.like': 'إعجاب',
  'reels.comment': 'تعليق',
  'reels.share': 'مشاركة',
  'reels.save': 'حفظ',
  'reels.addComment': 'أضف تعليقاً...',
  'reels.beFirst': 'كن أول من يعلق.',
  'reels.comments': 'التعليقات',

  'stories.title': 'القصص',
  'stories.yourStory': 'قصتك',
  'stories.reply': 'رد',

  'upload.title': 'رفع فيديو أو صورة',
  'upload.tap': 'اضغط لرفع فيديو أو صورة',
  'upload.formats': 'MP4, MOV, JPG, PNG',
  'upload.caption': 'التعليق',
  'upload.captionPlaceholder': 'اكتب تعليقاً...',
  'upload.hashtags': 'الوسوم',
  'upload.addHashtag': 'أضف وسماً...',
  'upload.add': 'إضافة',

  'profile.edit': 'تعديل الملف',
  'profile.fullName': 'الاسم الكامل',
  'profile.parish': 'الكنيسة',
  'profile.bio': 'نبذة',
  'profile.bioPlaceholder': 'اكتب عن نفسك...',
  'profile.posts': 'المنشورات',
  'profile.saved': 'المحفوظات',
  'profile.liked': 'المعجبات',
  'profile.followers': 'المتابعون',
  'profile.following': 'يتابع',
  'profile.events': 'الفعاليات',
  'profile.connections': 'الاتصالات',
  'profile.changePhoto': 'تغيير الصورة',

  'messenger.title': 'الرسائل',
  'messenger.unread': 'غير مقروء',
  'messenger.selectConv': 'اختر محادثة',
  'messenger.selectSub': 'اختر صديقاً لعرض سجل الرسائل.',
  'messenger.typePlaceholder': 'اكتب رسالة...',
  'messenger.activeNow': 'متصل الآن',
  'messenger.offline': 'غير متصل',
  'messenger.sayHello': 'قل مرحباً لـ',
  'messenger.startConv': 'ابدأ المحادثة',
  'messenger.noConversations': 'لا توجد محادثات بعد. أضف أصدقاء لبدء المراسلة.',
  'messenger.sentPhoto': 'تم إرسال صورة',
  'messenger.voiceMessage': 'رسالة صوتية',

  'call.participants': 'مشارك',
  'call.participantsPl': 'مشاركون',
  'call.speaking': 'يتحدث',
  'call.mute': 'كتم',
  'call.unmute': 'إلغاء الكتم',
  'call.startVideo': 'تشغيل الفيديو',
  'call.stopVideo': 'إيقاف الفيديو',
  'call.share': 'مشاركة',
  'call.raiseHand': 'رفع اليد',

  'landing.welcome': 'مرحباً بك في أورثوذكس كونكت',
  'landing.signIn': 'سجّل الدخول للانضمام إلى مجتمع كنيستك.',
  'landing.continueGoogle': 'المتابعة مع جوجل',
  'landing.connecting': 'جارٍ الاتصال...',
  'landing.hero1': 'حيث',
  'landing.hero2': 'الكنيسة',
  'landing.hero3': 'تلتقي',
  'landing.hero4': 'بالشبكة',
  'landing.heroDesc': 'تواصل مع المسيحيين الأرثوذكس عبر الكنائس. شارك حياتك، راسل أصدقاءك، وانضم إلى دراسات الكتاب المقدس المباشرة.',
  'landing.tagline': 'البيت الاجتماعي للأرثوذكس المؤمنين',
  'landing.fellowship': 'شركة',
  'landing.goLive': 'بث مباشر',
  'landing.stayClose': 'ابقَ قريباً',
  'landing.private': 'مجتمع خاص',
  'landing.privacy': 'شبكة خاصة للمؤمنين الأرثوذكس — مبنية للشركة وليس للخوارزمية.',
  'landing.terms': 'شروط الخدمة',
  'landing.privacyPolicy': 'سياسة الخصوصية',
  'landing.byContinue': 'بالمتابعة فإنك توافق على',
  'landing.and': 'و',
  'landing.footer': 'أورثوذكس كونكت · نسخة تجريبية · غير تابع لأي ولاية قضائية محددة',
};

const dicts: Record<Lang, Dict> = { en, ar };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);
const LANG_KEY = 'oc-lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && ['en', 'ar'].includes(saved)) {
      setLangState(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (key: string) => dicts[lang][key] ?? key;
  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
