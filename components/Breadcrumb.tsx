'use client';

import React from 'react';
import { Movie, User, Group } from '@/lib/types';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-4">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <i className="fa-solid fa-chevron-right text-gray-600 text-[10px]"></i>
          )}
          {item.isActive ? (
            <span className="text-main font-semibold">{item.label}</span>
          ) : item.onClick ? (
            <button
              onClick={item.onClick}
              className="hover:text-[var(--accent-color)] transition-colors duration-200 active:scale-95"
            >
              {item.label}
            </button>
          ) : (
            <span>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

interface BreadcrumbBuilderProps {
  activeTab: string;
  activeGroup: string | null;
  groupData: Group | null;
  activeProfile: User | null;
  selectedMovie: Movie | null;
  onNavigate: {
    toHome: () => void;
    toGroup: (groupId: string) => void;
    toProfile: (user: User) => void;
  };
}

export const buildBreadcrumbs = ({
  activeTab,
  activeGroup,
  groupData,
  activeProfile,
  selectedMovie,
  onNavigate,
}: BreadcrumbBuilderProps): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [];

  // Always start with Home
  items.push({
    label: 'Home',
    onClick: onNavigate.toHome,
    isActive: activeTab === 'Home' && !activeGroup && !activeProfile && !selectedMovie,
  });

  // If viewing a movie detail
  if (selectedMovie) {
    items.push({
      label: selectedMovie.title,
      isActive: true,
    });
    return items;
  }

  // If viewing a profile
  if (activeProfile) {
    items.push({
      label: activeProfile.username || activeProfile.name || 'Profile',
      isActive: true,
    });
    return items;
  }

  // If viewing a group
  if (activeGroup) {
    items.push({
      label: 'Group',
      onClick: () => onNavigate.toGroup(activeGroup),
      isActive: activeTab !== 'Group Settings',
    });

    if (activeTab === 'Group Settings') {
      items.push({
        label: groupData?.name || 'Group',
        onClick: () => onNavigate.toGroup(activeGroup),
        isActive: false,
      });
      items.push({
        label: 'Settings',
        isActive: true,
      });
    } else {
      // Update the Group item to be active
      items[items.length - 1].isActive = true;
    }
    return items;
  }

  // Handle other tabs
  if (activeTab !== 'Home') {
    items.push({
      label: activeTab,
      isActive: true,
    });
  }

  return items;
};

export default Breadcrumb;

