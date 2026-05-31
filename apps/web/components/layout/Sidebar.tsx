import { navigation } from "../../lib/navigation";

export function Sidebar() {
  return <aside className="sidebar"><nav>{navigation.map((item) => <a className="nav-item" href={item.href} key={item.href}>{item.label}</a>)}</nav></aside>;
}
