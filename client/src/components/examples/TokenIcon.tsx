import TokenIcon from '../TokenIcon';

export default function TokenIconExample() {
  return (
    <div className="flex items-center gap-4 p-4">
      <TokenIcon symbol="DOGGO" size="sm" />
      <TokenIcon symbol="USDC" size="md" />
      <TokenIcon symbol="RARE" size="lg" />
    </div>
  );
}
