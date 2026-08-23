import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Input } from './input';

/**
 * Self-contained visual spot-check for the four Task 2 primitives
 * (button, card, input, badge) against saboteur-base.css tokens. Not
 * wired into App.tsx — Task 2 does not own that file. Mount this
 * temporarily in main.tsx/App.tsx during development to eyeball the
 * result against the styles repo's Storybook (Examples/UI Primitives),
 * then remove the wiring; the component itself is left in place as the
 * styled-primitives deliverable and as a harness for later tasks.
 */
export function PrimitivesDemo() {
  return (
    <div className="flex min-h-screen flex-col gap-8 bg-background p-12">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="default">Primary action</Button>
        <Button variant="outline">Secondary action</Button>
        <Button variant="ghost">Tertiary action</Button>
        <Button variant="destructive">Delete vault</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge>Live</Badge>
        <Badge variant="outline">Canonical</Badge>
        <Badge variant="muted">Draft</Badge>
        <Badge variant="secondary">v0.6</Badge>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Local-first writing studio</CardTitle>
          <CardDescription>
            A writing environment that respects your files, your workflow, and your authorship.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input placeholder="e.g. quiet-places" />
          <Input placeholder="Disabled" disabled />
        </CardContent>
      </Card>
    </div>
  );
}
