import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  size?: 'small' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'small', ...props }) => {
  return (
    <button
      className={`px-4 py-2 ${variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-transparent'} ${size === 'icon' ? 'p-2' : ''}`}
      {...props}
    >
      {props.children}
    </button>
  );
};
