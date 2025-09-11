# Architectural Decisions

## State Management Patterns

### Decision: UI State Storage Location

**Date**: 2025-01-11

**Context**: 
When managing UI element states (dropdowns, toggles, active states), we need to decide where to store the state information.

**Options Considered**:

#### Option 1: JavaScript State Management
```javascript
let currentOpenDropdown = null;
if (currentOpenDropdown) {
  currentOpenDropdown.style.display = 'none';
}
```

**Pros**:
- O(1) performance for state access
- Direct references to elements
- Good for high-frequency updates
- Centralized state logic

**Cons**:
- State invisible in DOM inspector
- Risk of stale references
- Memory leak potential
- Harder to debug visually

#### Option 2: CSS Class-Based State (CHOSEN)
```javascript
.menu-dropdown { display: none; }
.menu-dropdown.open { display: block; }
dropdown.classList.toggle('open');
```

**Pros**:
- State visible in DOM inspector
- Self-documenting HTML
- No memory leak risk
- CSS transitions possible
- Resilient to DOM changes
- Better separation of concerns

**Cons**:
- O(n) for querying all elements with class
- Slightly slower for high-frequency updates

**Decision**: 
Use CSS class-based state for UI elements that:
- Update infrequently (user interactions)
- Are primarily visual changes
- Benefit from CSS transitions
- Need easy debugging

Use JavaScript state for:
- High-frequency updates (>10Hz)
- Complex state logic
- Performance-critical paths

**Rationale**:
For menu dropdowns and similar UI elements, the benefits of debuggability, maintainability, and CSS integration outweigh the negligible performance difference.

---

## DOM Manipulation Patterns

### Decision: Element Update vs Replacement

**Date**: 2025-01-11

**Context**:
When UI needs to change dynamically, we must decide whether to update existing elements or replace them.

**Options Considered**:

#### Option 1: Element Replacement
```javascript
toolbar.removeChild(oldElement);
toolbar.appendChild(newElement);
```

**Cons**:
- Destroys event handlers
- Loses element state
- Causes reflow/repaint
- Focus/selection lost

#### Option 2: Element Updates (CHOSEN)
```javascript
element.textContent = newText;
element.dataset.mode = newMode;
```

**Pros**:
- Preserves event handlers
- Maintains element state
- Minimal reflow
- Focus preserved

**Decision**:
Never destroy and recreate DOM elements unless absolutely necessary. Always prefer updating properties, attributes, and text content.

**Exceptions**:
- Complete structural changes
- Security (clearing untrusted HTML)

---

## Performance Optimization Patterns

### Decision: Conditional DOM Updates

**Date**: 2025-01-11

**Context**:
Frequent DOM updates can impact performance, even when setting the same value.

**Pattern** (ADOPTED):
```javascript
// Always check before updating
if (element.textContent !== newText) {
  element.textContent = newText;
}

if (!element.classList.contains('active')) {
  element.classList.add('active');
}
```

**Rationale**:
- Reading DOM is fast (~0.001ms)
- Writing DOM triggers reflow/repaint
- Prevents unnecessary style recalculation
- Reduces battery usage

**Apply to**:
- LED status indicators
- Button states
- Text updates
- Style changes

---

## Event Handler Patterns

### Decision: Event Delegation vs Direct Attachment

**Date**: 2025-01-11

**Context**:
For dynamically created elements, we need a strategy for event handling.

**Guideline**:
- Use **event delegation** for dynamic content
- Use **direct attachment** for static elements
- Never use `onclick =` property assignment
- Always use `addEventListener()`

**Example**:
```javascript
// Delegation for dynamic content
toolbar.addEventListener('click', (e) => {
  if (e.target.matches('.dynamic-button')) {
    handleButtonClick(e.target);
  }
});

// Direct for static content
staticButton.addEventListener('click', handleClick);
```

---

## Control Line Architecture

### Decision: Unified Reset Control

**Date**: 2025-01-11

**Context**:
DTR and RTS are different physical lines but serve the same function (reset).

**Previous Architecture**:
- Separate buttons with different IDs
- Separate handlers for each
- Complete replacement when switching

**New Architecture** (ADOPTED):
```html
<button id="reset-toggle" data-line="DTR">DTR</button>
<input type="checkbox" id="reset-checkbox">
```

**Benefits**:
- Single handler for reset function
- Just update button text and data attribute
- No DOM replacement needed
- Clearer semantic meaning

**Principle**:
Abstract the function (reset) from the implementation (which line).

---

## CSS Architecture

### Decision: Styling Through Classes vs Inline Styles

**Date**: 2025-01-11

**Guideline**:
- Use CSS classes for states (`.active`, `.open`, `.error`)
- Use inline styles only for dynamic values (positions, colors from data)
- Initialize style-once properties using data attributes

**Example**:
```javascript
// Good - state via class
element.classList.add('led-on');

// Good - dynamic value
element.style.color = colorFromData;

// Good - one-time setup
if (!element.dataset.initialized) {
  element.style.fontSize = '20px';
  element.dataset.initialized = 'true';
}

// Bad - repeated inline styles
element.style.fontSize = '20px';  // Set every update
```

---

## Update Guidelines

This document should be updated when:
- Choosing between implementation patterns
- Establishing new conventions
- Learning from bugs/issues
- Deprecating old patterns

Each decision should include:
- Context and problem
- Options considered
- Decision made
- Rationale
- Example code