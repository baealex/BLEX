import IconArrowBackUp from '@tabler/icons-react/icons/IconArrowBackUp';
import IconArrowLeft from '@tabler/icons-react/icons/IconArrowLeft';
import IconArrowRight from '@tabler/icons-react/icons/IconArrowRight';
import IconBell from '@tabler/icons-react/icons/IconBell';
import IconBook from '@tabler/icons-react/icons/IconBook';
import IconBrandBluesky from '@tabler/icons-react/icons/IconBrandBluesky';
import IconBrandDiscord from '@tabler/icons-react/icons/IconBrandDiscord';
import IconBrandFacebook from '@tabler/icons-react/icons/IconBrandFacebook';
import IconBrandGithub from '@tabler/icons-react/icons/IconBrandGithub';
import IconBrandInstagram from '@tabler/icons-react/icons/IconBrandInstagram';
import IconBrandLinkedin from '@tabler/icons-react/icons/IconBrandLinkedin';
import IconBrandTelegram from '@tabler/icons-react/icons/IconBrandTelegram';
import IconBrandThreads from '@tabler/icons-react/icons/IconBrandThreads';
import IconBrandTiktok from '@tabler/icons-react/icons/IconBrandTiktok';
import IconBrandX from '@tabler/icons-react/icons/IconBrandX';
import IconBrandYoutube from '@tabler/icons-react/icons/IconBrandYoutube';
import IconCalendar from '@tabler/icons-react/icons/IconCalendar';
import IconCamera from '@tabler/icons-react/icons/IconCamera';
import IconCheck from '@tabler/icons-react/icons/IconCheck';
import IconChevronDown from '@tabler/icons-react/icons/IconChevronDown';
import IconChevronLeft from '@tabler/icons-react/icons/IconChevronLeft';
import IconChevronRight from '@tabler/icons-react/icons/IconChevronRight';
import IconChevronsLeft from '@tabler/icons-react/icons/IconChevronsLeft';
import IconChevronsRight from '@tabler/icons-react/icons/IconChevronsRight';
import IconClock from '@tabler/icons-react/icons/IconClock';
import IconCode from '@tabler/icons-react/icons/IconCode';
import IconCompass from '@tabler/icons-react/icons/IconCompass';
import IconDotsVertical from '@tabler/icons-react/icons/IconDotsVertical';
import IconEdit from '@tabler/icons-react/icons/IconEdit';
import IconExclamationMark from '@tabler/icons-react/icons/IconExclamationMark';
import IconFileText from '@tabler/icons-react/icons/IconFileText';
import IconHash from '@tabler/icons-react/icons/IconHash';
import IconHeart from '@tabler/icons-react/icons/IconHeart';
import IconLink from '@tabler/icons-react/icons/IconLink';
import IconList from '@tabler/icons-react/icons/IconList';
import IconLock from '@tabler/icons-react/icons/IconLock';
import IconLogout from '@tabler/icons-react/icons/IconLogout';
import IconMenu2 from '@tabler/icons-react/icons/IconMenu2';
import IconMessage from '@tabler/icons-react/icons/IconMessage';
import IconMessageCircle from '@tabler/icons-react/icons/IconMessageCircle';
import IconMessageDots from '@tabler/icons-react/icons/IconMessageDots';
import IconMoon from '@tabler/icons-react/icons/IconMoon';
import IconPalette from '@tabler/icons-react/icons/IconPalette';
import IconPencil from '@tabler/icons-react/icons/IconPencil';
import IconPhoto from '@tabler/icons-react/icons/IconPhoto';
import IconPin from '@tabler/icons-react/icons/IconPin';
import IconPlus from '@tabler/icons-react/icons/IconPlus';
import IconSearch from '@tabler/icons-react/icons/IconSearch';
import IconSettings from '@tabler/icons-react/icons/IconSettings';
import IconShare from '@tabler/icons-react/icons/IconShare';
import IconSpeakerphone from '@tabler/icons-react/icons/IconSpeakerphone';
import IconStack2 from '@tabler/icons-react/icons/IconStack2';
import IconSun from '@tabler/icons-react/icons/IconSun';
import IconTags from '@tabler/icons-react/icons/IconTags';
import IconUpload from '@tabler/icons-react/icons/IconUpload';
import IconUser from '@tabler/icons-react/icons/IconUser';
import IconWriting from '@tabler/icons-react/icons/IconWriting';
import IconX from '@tabler/icons-react/icons/IconX';

const glyphs = {
  'arrow-back-up': IconArrowBackUp,
  'arrow-left': IconArrowLeft,
  'arrow-right': IconArrowRight,
  'bell': IconBell,
  'book': IconBook,
  'brand-bluesky': IconBrandBluesky,
  'brand-discord': IconBrandDiscord,
  'brand-facebook': IconBrandFacebook,
  'brand-github': IconBrandGithub,
  'brand-instagram': IconBrandInstagram,
  'brand-linkedin': IconBrandLinkedin,
  'brand-telegram': IconBrandTelegram,
  'brand-threads': IconBrandThreads,
  'brand-tiktok': IconBrandTiktok,
  'brand-x': IconBrandX,
  'brand-youtube': IconBrandYoutube,
  'calendar': IconCalendar,
  'camera': IconCamera,
  'check': IconCheck,
  'chevron-down': IconChevronDown,
  'chevron-left': IconChevronLeft,
  'chevron-right': IconChevronRight,
  'chevrons-left': IconChevronsLeft,
  'chevrons-right': IconChevronsRight,
  'clock': IconClock,
  'code': IconCode,
  'compass': IconCompass,
  'dots-vertical': IconDotsVertical,
  'edit': IconEdit,
  'exclamation-mark': IconExclamationMark,
  'file-text': IconFileText,
  'hash': IconHash,
  'heart': IconHeart,
  'link': IconLink,
  'list': IconList,
  'lock': IconLock,
  'logout': IconLogout,
  'menu-2': IconMenu2,
  'message': IconMessage,
  'message-circle': IconMessageCircle,
  'message-dots': IconMessageDots,
  'moon': IconMoon,
  'palette': IconPalette,
  'pencil': IconPencil,
  'photo': IconPhoto,
  'pin': IconPin,
  'plus': IconPlus,
  'search': IconSearch,
  'settings': IconSettings,
  'share': IconShare,
  'speakerphone': IconSpeakerphone,
  'stack-2': IconStack2,
  'sun': IconSun,
  'tags': IconTags,
  'upload': IconUpload,
  'user': IconUser,
  'writing': IconWriting,
  'x': IconX,
};

export type SiteIconName = keyof typeof glyphs;

/** Follows the surrounding font size unless a size class is given. */
export function SiteIcon({ name, className }: { name: SiteIconName; className?: string }) {
  const Glyph = glyphs[name];
  return <Glyph size="1em" aria-hidden="true" className={`inline-block shrink-0 align-[-0.125em]${className ? ` ${className}` : ''}`} />;
}
