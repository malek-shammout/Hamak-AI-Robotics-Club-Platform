import {BinaryBar} from '@/components/binary-bar';

export function PageHeading({title, lead}: {title: string; lead?: string}) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {lead ? <p className="mt-3 max-w-2xl text-[--foreground-muted]">{lead}</p> : null}
      <BinaryBar className="mt-5" />
    </header>
  );
}
