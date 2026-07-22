import { Link } from "@tanstack/react-router";

type Props = {
  id?: string | null;
  nome?: string | null;
  className?: string;
  fallback?: string;
};

/** Nome de cliente clicável que abre a página do cliente em "Por Clientes". */
export function ClienteLink({ id, nome, className, fallback = "—" }: Props) {
  if (!id || !nome) return <span className={className}>{nome ?? fallback}</span>;
  return (
    <Link
      to="/por-clientes/$clienteId"
      params={{ clienteId: id }}
      className={
        (className ?? "") +
        " text-primary hover:underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
      }
    >
      {nome}
    </Link>
  );
}
