import React from 'react';

/**
 * Zero-dependency animation primitives that provide a drop-in compatible API
 * for `motion.div`, `motion.tr`, `motion.path`, and `AnimatePresence` without
 * requiring the external `motion` package to be installed in host applications.
 */

export interface MotionProps extends React.HTMLAttributes<HTMLElement> {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  layout?: boolean;
  children?: React.ReactNode;
}

const stripMotionProps = (props: Record<string, any>) => {
  const {
    initial,
    animate,
    exit,
    transition,
    layout,
    whileHover,
    whileTap,
    variants,
    ...rest
  } = props;
  return rest;
};

const createMotionElement = <T extends keyof React.JSX.IntrinsicElements>(tag: T) => {
  const Component = React.forwardRef<any, any>((props, ref) => {
    const cleanProps = stripMotionProps(props);
    return React.createElement(tag, { ...cleanProps, ref });
  });
  Component.displayName = `motion.${String(tag)}`;
  return Component;
};

export const motion = {
  div: createMotionElement('div'),
  tr: createMotionElement('tr'),
  td: createMotionElement('td'),
  span: createMotionElement('span'),
  path: createMotionElement('path'),
  button: createMotionElement('button'),
};

export const AnimatePresence: React.FC<{
  children?: React.ReactNode;
  initial?: boolean;
  mode?: 'sync' | 'wait' | 'popLayout';
}> = ({ children }) => {
  return <>{children}</>;
};
