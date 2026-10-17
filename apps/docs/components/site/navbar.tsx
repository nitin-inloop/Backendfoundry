/**
 * <Navbar> — server wrapper: builds the search index and renders the client navbar.
 */
import { NavbarClient } from "./navbar-client";
import { getSearchItems } from "./search-items";

export function Navbar() {
  return <NavbarClient searchItems={getSearchItems()} />;
}
