/** @format */

// src/classes/shared/htmlMenuBar.ts

import { EventEmitter } from 'events';

/**
 * Menu item configuration matching Electron's MenuItem structure
 */
export interface MenuItemConfig {
  label?: string;
  type?: 'normal' | 'separator' | 'checkbox' | 'radio';
  click?: () => void;
  accelerator?: string;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  submenu?: MenuItemConfig[];
  id?: string;
  role?: string;
}

/**
 * Menu configuration
 */
export interface MenuConfig {
  label: string;
  items: MenuItemConfig[];
}

/**
 * HTMLMenuBar - Custom HTML-based menu bar with Electron-like API
 * 
 * Provides a lightweight, cross-platform menu system that renders
 * inside the window instead of using native OS menus.
 * 
 * Features:
 * - Full ARIA accessibility support
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Accelerator key handling
 * - Checkbox and radio menu items
 * - Submenus
 * - Dynamic enable/disable
 * - Electron Menu API compatibility
 */
export class HTMLMenuBar extends EventEmitter {
  private container: HTMLElement | null = null;
  private menus: MenuConfig[] = [];
  private activeMenu: string | null = null;
  private dropdownElement: HTMLElement | null = null;
  private keyboardNavIndex = -1;
  private acceleratorMap: Map<string, () => void> = new Map();

  constructor() {
    super();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  /**
   * Initialize the menu bar in the specified container
   */
  public initialize(containerId: string): void {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Menu container element '${containerId}' not found`);
    }

    // Create menu bar structure
    this.container.innerHTML = '';
    this.container.className = 'html-menu-bar';
    this.container.setAttribute('role', 'menubar');
    this.container.setAttribute('aria-label', 'Application menu');

    // Create dropdown container
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.className = 'html-menu-dropdown hidden';
    this.dropdownElement.setAttribute('role', 'menu');
    document.body.appendChild(this.dropdownElement);

    // Set up event listeners
    this.container.addEventListener('click', this.handleMenuClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('click', this.handleClickOutside);
  }

  /**
   * Set the menu configuration
   */
  public setMenus(menus: MenuConfig[]): void {
    this.menus = menus;
    this.render();
    this.buildAcceleratorMap();
  }

  /**
   * Render the menu bar
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = '';
    
    this.menus.forEach((menu, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'html-menu-item';
      menuItem.setAttribute('role', 'menuitem');
      menuItem.setAttribute('aria-haspopup', 'true');
      menuItem.setAttribute('aria-expanded', 'false');
      menuItem.setAttribute('tabindex', index === 0 ? '0' : '-1');
      menuItem.dataset.menu = menu.label.toLowerCase().replace(/\s+/g, '-');
      menuItem.textContent = menu.label;
      
      this.container!.appendChild(menuItem);
    });
  }

  /**
   * Handle menu item clicks
   */
  private handleMenuClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('html-menu-item')) return;

    const menuName = target.dataset.menu;
    if (!menuName) return;

    // Toggle menu
    if (this.activeMenu === menuName) {
      this.closeDropdown();
    } else {
      this.openDropdown(menuName, target);
    }
  }

  /**
   * Open a dropdown menu
   */
  private openDropdown(menuName: string, menuElement: HTMLElement): void {
    const menu = this.menus.find(m => 
      m.label.toLowerCase().replace(/\s+/g, '-') === menuName
    );
    
    if (!menu || !this.dropdownElement) return;

    // Update ARIA attributes
    menuElement.setAttribute('aria-expanded', 'true');
    
    // Position dropdown
    const rect = menuElement.getBoundingClientRect();
    this.dropdownElement.style.left = `${rect.left}px`;
    this.dropdownElement.style.top = `${rect.bottom}px`;

    // Render menu items
    this.dropdownElement.innerHTML = '';
    menu.items.forEach((item, index) => {
      const element = this.createMenuItem(item, index);
      this.dropdownElement!.appendChild(element);
    });

    // Show dropdown
    this.dropdownElement.classList.remove('hidden');
    this.activeMenu = menuName;
    this.keyboardNavIndex = -1;

    // Focus first item for keyboard navigation
    const firstItem = this.dropdownElement.querySelector('[role="menuitem"]:not([aria-disabled="true"])') as HTMLElement;
    if (firstItem) {
      firstItem.focus();
      this.keyboardNavIndex = 0;
    }
  }

  /**
   * Create a menu item element
   */
  private createMenuItem(item: MenuItemConfig, index: number): HTMLElement {
    // Handle separator
    if (item.type === 'separator') {
      const separator = document.createElement('div');
      separator.className = 'html-menu-separator';
      separator.setAttribute('role', 'separator');
      return separator;
    }

    const element = document.createElement('div');
    element.className = 'html-menu-dropdown-item';
    
    // Set ARIA attributes based on type
    if (item.type === 'checkbox') {
      element.setAttribute('role', 'menuitemcheckbox');
      element.setAttribute('aria-checked', item.checked ? 'true' : 'false');
    } else if (item.type === 'radio') {
      element.setAttribute('role', 'menuitemradio');
      element.setAttribute('aria-checked', item.checked ? 'true' : 'false');
    } else {
      element.setAttribute('role', 'menuitem');
    }

    // Handle disabled state
    const isEnabled = item.enabled !== false;
    element.setAttribute('aria-disabled', isEnabled ? 'false' : 'true');
    element.setAttribute('tabindex', isEnabled ? '0' : '-1');
    if (!isEnabled) {
      element.classList.add('disabled');
    }

    // Add checkbox/radio indicator
    if (item.type === 'checkbox' || item.type === 'radio') {
      const indicator = document.createElement('span');
      indicator.className = 'html-menu-indicator';
      indicator.textContent = item.checked ? '✓' : '';
      element.appendChild(indicator);
    }

    // Add label
    const label = document.createElement('span');
    label.className = 'html-menu-label';
    label.textContent = item.label || '';
    element.appendChild(label);

    // Add accelerator
    if (item.accelerator) {
      const accel = document.createElement('span');
      accel.className = 'html-menu-accelerator';
      accel.textContent = this.formatAccelerator(item.accelerator);
      element.appendChild(accel);
      element.setAttribute('aria-keyshortcuts', item.accelerator);
    }

    // Add submenu indicator
    if (item.submenu) {
      const arrow = document.createElement('span');
      arrow.className = 'html-menu-submenu-arrow';
      arrow.textContent = '▶';
      element.appendChild(arrow);
      element.setAttribute('aria-haspopup', 'true');
    }

    // Handle click
    if (isEnabled && item.click) {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.type === 'checkbox') {
          item.checked = !item.checked;
          element.setAttribute('aria-checked', item.checked ? 'true' : 'false');
          const indicator = element.querySelector('.html-menu-indicator');
          if (indicator) {
            indicator.textContent = item.checked ? '✓' : '';
          }
        }
        item.click!();
        this.closeDropdown();
        this.emit('menu-click', { item, label: item.label });
      });
    }

    return element;
  }

  /**
   * Format accelerator for display
   */
  private formatAccelerator(accelerator: string): string {
    return accelerator
      .replace(/CommandOrControl|CmdOrCtrl|Cmd/g, '⌘')
      .replace(/Alt|Option/g, '⌥')
      .replace(/Shift/g, '⇧')
      .replace(/\+/g, '');
  }

  /**
   * Build accelerator key map
   */
  private buildAcceleratorMap(): void {
    this.acceleratorMap.clear();
    
    this.menus.forEach(menu => {
      menu.items.forEach(item => {
        if (item.accelerator && item.click && item.enabled !== false) {
          const key = this.parseAccelerator(item.accelerator);
          this.acceleratorMap.set(key, item.click);
        }
      });
    });
  }

  /**
   * Parse accelerator string to key combination
   */
  private parseAccelerator(accelerator: string): string {
    const parts = accelerator.split('+').map(p => p.trim().toLowerCase());
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1).sort().join('+');
    return modifiers ? `${modifiers}+${key}` : key;
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Check for accelerator keys
    const modifiers = [];
    if (event.metaKey || event.ctrlKey) modifiers.push('cmd');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    
    const key = event.key.toLowerCase();
    const combo = modifiers.length > 0 ? `${modifiers.sort().join('+')}+${key}` : key;
    
    const handler = this.acceleratorMap.get(combo);
    if (handler) {
      event.preventDefault();
      handler();
      return;
    }

    // Handle dropdown navigation
    if (!this.activeMenu) return;

    switch (event.key) {
      case 'Escape':
        this.closeDropdown();
        event.preventDefault();
        break;
        
      case 'ArrowDown':
        this.navigateDropdown(1);
        event.preventDefault();
        break;
        
      case 'ArrowUp':
        this.navigateDropdown(-1);
        event.preventDefault();
        break;
        
      case 'Enter':
        this.selectCurrentItem();
        event.preventDefault();
        break;
    }
  }

  /**
   * Navigate dropdown with keyboard
   */
  private navigateDropdown(direction: number): void {
    if (!this.dropdownElement) return;
    
    const items = Array.from(
      this.dropdownElement.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
    ) as HTMLElement[];
    
    if (items.length === 0) return;
    
    this.keyboardNavIndex = Math.max(0, Math.min(items.length - 1, this.keyboardNavIndex + direction));
    items[this.keyboardNavIndex]?.focus();
  }

  /**
   * Select current keyboard navigation item
   */
  private selectCurrentItem(): void {
    if (!this.dropdownElement) return;
    
    const items = Array.from(
      this.dropdownElement.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
    ) as HTMLElement[];
    
    if (this.keyboardNavIndex >= 0 && this.keyboardNavIndex < items.length) {
      items[this.keyboardNavIndex]?.click();
    }
  }

  /**
   * Handle clicks outside menu
   */
  private handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    
    if (!this.container?.contains(target) && !this.dropdownElement?.contains(target)) {
      this.closeDropdown();
    }
  }

  /**
   * Close the dropdown menu
   */
  private closeDropdown(): void {
    if (!this.dropdownElement) return;
    
    // Update ARIA attributes
    const menuItems = this.container?.querySelectorAll('[aria-expanded="true"]');
    menuItems?.forEach(item => {
      item.setAttribute('aria-expanded', 'false');
    });
    
    this.dropdownElement.classList.add('hidden');
    this.activeMenu = null;
    this.keyboardNavIndex = -1;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleClickOutside);
    
    if (this.dropdownElement) {
      this.dropdownElement.remove();
      this.dropdownElement = null;
    }
    
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    
    this.acceleratorMap.clear();
  }
}