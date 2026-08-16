import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('App shell', () => {
  it('ประกาศชื่อผลิตภัณฑ์และ main landmark', () => {
    render(<App />);
    expect(screen.getByText('Printer Fleet Command Center')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
