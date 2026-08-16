import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('App shell', () => {
  it('ประกาศชื่อผลิตภัณฑ์และ main landmark', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('Printer Fleet Command Center');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
