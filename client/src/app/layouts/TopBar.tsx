import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, X, Server, Cloud, Key, GitBranch, Package, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import styles from './TopBar.module.css';

interface SearchResult {
  type: 'page' | 'action';
  icon: typeof Server;
  label: string;
  path?: string;
  action?: () => void;
}

const searchableItems: SearchResult[] = [
  { type: 'page', icon: Server, label: 'Machines', path: '/machines' },
  { type: 'page', icon: Cloud, label: 'Providers', path: '/providers' },
  { type: 'page', icon: Key, label: 'Keys', path: '/keys' },
  { type: 'page', icon: GitBranch, label: 'Deployments', path: '/deployments' },
  { type: 'page', icon: Package, label: 'Bootstrap', path: '/bootstrap' },
  { type: 'page', icon: Settings, label: 'Settings', path: '/settings' },
];

export function TopBar() {
  const navigate = useNavigate();
  const { rightMenuOpen, setRightMenuOpen } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredResults = searchQuery.trim()
    ? searchableItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleResultClick = (result: SearchResult) => {
    if (result.path) {
      navigate(result.path);
    } else if (result.action) {
      result.action();
    }
    setSearchQuery('');
    setSearchFocused(false);
  };

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={styles.topBar}>
      {/* Logo */}
      <div className={styles.logo} onClick={() => navigate('/machines')}>
        <img src="/machina_icon.png" alt="Machina" className={styles.logoIcon} />
        <span className={styles.logoText}>Machina</span>
      </div>

      {/* Search */}
      <div className={styles.searchContainer} ref={searchRef}>
        <div className={clsx(styles.searchBox, searchFocused && styles.searchBoxFocused)}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              className={styles.clearButton}
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchFocused && filteredResults.length > 0 && (
          <div className={styles.searchResults}>
            {filteredResults.map((result, index) => (
              <button
                key={index}
                className={styles.searchResult}
                onClick={() => handleResultClick(result)}
              >
                <result.icon size={14} className={styles.resultIcon} />
                <span>{result.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hamburger Menu */}
      <button
        className={styles.menuButton}
        onClick={() => setRightMenuOpen(!rightMenuOpen)}
        aria-label="Toggle menu"
      >
        {rightMenuOpen ? <X size={16} /> : <Menu size={16} />}
      </button>
    </header>
  );
}

