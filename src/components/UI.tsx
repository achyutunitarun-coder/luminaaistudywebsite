/**
 * Lumina UI — Runtime Style Normalizer
 *
 * This component fixes the visual inconsistency problem:
 * The codebase has hundreds of inline style={{}} attributes that override
 * the CSS design system. This component strips them at runtime so the
 * CSS variables (defined in index.css) take effect everywhere.
 *
 * Strategy:
 * 1. Strip inline styles from elements that use Tailwind classes
 * 2. Preserve inline styles that are functional (dynamic values like widths)
 * 3. Re-run after every React re-render via MutationObserver
 */
import { useEffect } from 'react';

// Properties that are likely functional (dynamic values) and should be kept
const FUNCTIONAL_PROPS = new Set([
  'width', 'height', 'top', 'left', 'right', 'bottom',
  'transform', 'opacity', 'z-index',
]);

// Properties that are visual and should be stripped
const VISUAL_PROPS = new Set([
  'background', 'backgroundColor', 'background-image', 'backgroundImage',
  'color', 'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'boxShadow', 'textShadow',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'lineHeight', 'letterSpacing', 'textAlign', 'textTransform',
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
  'overflow', 'position',
]);

export const UI = () => {
  useEffect(() => {
    const stripInlineStyles = () => {
      const elements = document.querySelectorAll('[style]');
      elements.forEach(el => {
        const styleAttr = el.getAttribute('style');
        if (!styleAttr) return;

        // Parse the inline style
        const declarations = styleAttr.split(';').filter(s => s.trim());
        const toRemove: string[] = [];
        const toKeep: string[] = [];

        declarations.forEach(decl => {
          const prop = decl.split(':')[0].trim();
          if (VISUAL_PROPS.has(prop)) {
            toRemove.push(prop);
          } else if (FUNCTIONAL_PROPS.has(prop)) {
            toKeep.push(decl);
          } else {
            // Unknown property — if it looks like a color or size, remove it
            const value = decl.split(':').slice(1).join(':').trim();
            if (value.includes('hsl') || value.includes('rgb') || value.includes('#') ||
                value.includes('blur') || value.includes('shadow') || value.includes('gradient') ||
                value.includes('linear-gradient') || value.includes('radial-gradient')) {
              toRemove.push(prop);
            } else {
              toKeep.push(decl);
            }
          }
        });

        // If all properties were visual, remove the style attribute entirely
        if (toKeep.length === 0) {
          el.removeAttribute('style');
        } else {
          // Otherwise, keep only functional properties
          el.setAttribute('style', toKeep.join('; ') + ';');
        }
      });
    };

    // Run immediately
    stripInlineStyles();

    // Re-run when DOM changes (React re-renders, navigation, etc.)
    const observer = new MutationObserver(() => {
      requestAnimationFrame(stripInlineStyles);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
};
