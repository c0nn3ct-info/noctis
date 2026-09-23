import { Github } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { GITHUB_URL } from '@/constants';

export function GithubLink() {
  return (
    <IconButton
      asChild
      variant="standard"
      size="s"
      className="h-11 w-11"
      aria-label="GitHub"
      title="GitHub"
    >
      <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
        <Github />
      </a>
    </IconButton>
  );
}
