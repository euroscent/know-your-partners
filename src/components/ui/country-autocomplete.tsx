import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const COUNTRIES = [
  "Afghanistan",
  "Ägypten",
  "Albanien",
  "Algerien",
  "Andorra",
  "Angola",
  "Argentinien",
  "Armenien",
  "Aserbaidschan",
  "Äthiopien",
  "Australien",
  "Bahrain",
  "Bangladesch",
  "Belgien",
  "Bolivien",
  "Bosnien und Herzegowina",
  "Brasilien",
  "Bulgarien",
  "Chile",
  "China",
  "Costa Rica",
  "Dänemark",
  "Deutschland",
  "Dominikanische Republik",
  "Ecuador",
  "El Salvador",
  "Estland",
  "Finnland",
  "Frankreich",
  "Georgien",
  "Ghana",
  "Griechenland",
  "Großbritannien",
  "Guatemala",
  "Honduras",
  "Indien",
  "Indonesien",
  "Irak",
  "Iran",
  "Irland",
  "Island",
  "Israel",
  "Italien",
  "Jamaika",
  "Japan",
  "Jemen",
  "Jordanien",
  "Kambodscha",
  "Kamerun",
  "Kanada",
  "Kasachstan",
  "Katar",
  "Kenia",
  "Kirgisistan",
  "Kolumbien",
  "Kosovo",
  "Kroatien",
  "Kuba",
  "Kuwait",
  "Laos",
  "Lettland",
  "Libanon",
  "Libyen",
  "Liechtenstein",
  "Litauen",
  "Luxemburg",
  "Malaysia",
  "Malta",
  "Marokko",
  "Mexiko",
  "Moldawien",
  "Monaco",
  "Mongolei",
  "Montenegro",
  "Nepal",
  "Neuseeland",
  "Niederlande",
  "Nigeria",
  "Nordmazedonien",
  "Norwegen",
  "Österreich",
  "Pakistan",
  "Palästina",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippinen",
  "Polen",
  "Portugal",
  "Rumänien",
  "Russland",
  "Saudi-Arabien",
  "Schweden",
  "Schweiz",
  "Senegal",
  "Serbien",
  "Singapur",
  "Slowakei",
  "Slowenien",
  "Somalia",
  "Spanien",
  "Sri Lanka",
  "Südafrika",
  "Südkorea",
  "Sudan",
  "Syrien",
  "Tadschikistan",
  "Taiwan",
  "Thailand",
  "Tschechien",
  "Tunesien",
  "Türkei",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "Ungarn",
  "Uruguay",
  "Usbekistan",
  "Venezuela",
  "Vereinigte Arabische Emirate",
  "Vereinigte Staaten",
  "Vietnam",
  "Weißrussland",
  "Zypern",
];

interface CountryAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function CountryAutocomplete({
  value,
  onValueChange,
  placeholder = "Land suchen...",
}: CountryAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredCountries = React.useMemo(() => {
    if (!inputValue) return COUNTRIES;
    const search = inputValue.toLowerCase();
    return COUNTRIES.filter((country) =>
      country.toLowerCase().includes(search)
    );
  }, [inputValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>Kein Land gefunden.</CommandEmpty>
            <CommandGroup>
              {filteredCountries.slice(0, 10).map((country) => (
                <CommandItem
                  key={country}
                  value={country}
                  onSelect={() => {
                    onValueChange(country);
                    setInputValue(country);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {country}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
