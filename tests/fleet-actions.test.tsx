import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('fleet actions', () => {
  it('renders printer IPs as links to the printer web interface', () => {
    render(<App />);

    const links = screen.getAllByRole('link', { name: '10.20.4.18' });

    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', 'http://10.20.4.18');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows the KKR account label', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'บัญชีผู้ใช้' })).toHaveTextContent('KKR');
  });

  it('provides a delete action inside mobile printer cards', () => {
    render(<App />);

    const mobileCard = Array.from(document.querySelectorAll('.card-list .printer-card')).find((card) => card.textContent?.includes('Finance · Ricoh C4503'));

    expect(mobileCard).not.toBeNull();
    expect(within(mobileCard as HTMLElement).getByRole('button', { name: 'ลบ Finance · Ricoh C4503' })).toBeInTheDocument();
  });
});
