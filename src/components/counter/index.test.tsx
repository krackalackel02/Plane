import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Counter from '.';

describe('Counter Component', () => {
  it('renders the initial count and increments on button click', () => {
    // Render the Counter component
    render(<Counter />);

    // Verify the initial count is 0
    const button = screen.getByRole('button', { name: /count is 0/i });
    expect(button).toBeInTheDocument();

    // Click the button and check if count increments
    fireEvent.click(button);
    expect(button).toHaveTextContent('count is 1');

    fireEvent.click(button);
    expect(button).toHaveTextContent('count is 2');
  });
});
