// Professional Enterprise Icons (Heroicons + specific SVGs for socials)
import React from 'react';
import {
  Squares2X2Icon,
  ChatBubbleLeftEllipsisIcon,
  WrenchScrewdriverIcon,
  CpuChipIcon,
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowsPointingInIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronRightIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon,
  CalendarIcon,
  UserCircleIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

// ----------------------------------------------------------------------------
// Aliasing Heroicons to match our original prop structures and names
// ----------------------------------------------------------------------------
const HeroAdapter = (IconComponent) => ({ size = 20, className = "", color, ...props }) => (
  <IconComponent 
    width={size} 
    height={size} 
    className={className} 
    strokeWidth={1.5} 
    color={color} 
    {...props} 
  />
);

export const LayoutDashboard = HeroAdapter(Squares2X2Icon);
export const MessageSquare = HeroAdapter(ChatBubbleLeftEllipsisIcon);
export const GitPullRequest = HeroAdapter(WrenchScrewdriverIcon); // Using Wrench for fix PRs
export const Cpu = HeroAdapter(CpuChipIcon);
export const RefreshCw = ({ className, size=20, ...p }) => <ArrowPathIcon width={size} className={className + " animate-spin"} {...p} />;
export const Zap = HeroAdapter(BoltIcon);
export const BarChart3 = HeroAdapter(ChartBarIcon);
export const Clock = HeroAdapter(ClockIcon);
export const GitMerge = HeroAdapter(ArrowsPointingInIcon);
export const AlertTriangle = HeroAdapter(ExclamationTriangleIcon);
export const TrendingUp = HeroAdapter(ArrowTrendingUpIcon);
export const CheckCircle2 = HeroAdapter(CheckCircleIcon);
export const XCircle = HeroAdapter(XCircleIcon);
export const ChevronRight = HeroAdapter(ChevronRightIcon);
export const Play = HeroAdapter(PlayIcon);
export const ExternalLink = HeroAdapter(ArrowTopRightOnSquareIcon);
export const Calendar = HeroAdapter(CalendarIcon);
export const User = HeroAdapter(UserCircleIcon);
export const Globe = HeroAdapter(GlobeAltIcon);
export const Search = HeroAdapter(MagnifyingGlassIcon);
export const AlertCircle = HeroAdapter(ExclamationCircleIcon);

// Loader needs to just spin an arrow
export const Loader2 = ({ className, size=20, ...p }) => (
    <ArrowPathIcon width={size} className={`${className} animate-spin`} {...p} />
);

// ----------------------------------------------------------------------------
// Custom Social / Specific Icons (Heroicons doesn't have brands)
// ----------------------------------------------------------------------------
const SvgBase = ({ children, size = 20, className = "", color = "currentColor" }) => (
  <svg 
    width={size} height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {children}
  </svg>
);

export const Twitter = (p) => <SvgBase {...p}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></SvgBase>;
export const Github = (p) => <SvgBase {...p}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></SvgBase>;
export const Brain = (p) => <SvgBase {...p}><path d="M9.5 2h5M2 9.5v5M22 9.5v5M12 2v20M2 12h20M9.5 22h5M6.5 6.5l11 11M17.5 6.5l-11 11"/></SvgBase>;
