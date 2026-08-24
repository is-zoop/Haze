import { Search, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, ComboboxContent, useComboboxContext } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption { value: string; label: string; }
interface MultiSelectComboboxProps { options: MultiSelectOption[]; values: string[]; onChange: (values: string[]) => void; placeholder: string; searchPlaceholder: string; clearLabel: string; selectedLabel: (count: number, isAllSelected: boolean) => string; className?: string; }

function MultiSelectPanel({ options, values, onChange, clearLabel }: Omit<MultiSelectComboboxProps, "placeholder" | "searchPlaceholder" | "selectedLabel" | "className">) {
  const { searchQuery } = useComboboxContext();
  const filtered = options.filter((option) => option.label.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const ordered = [...filtered].sort((left, right) => Number(values.includes(right.value)) - Number(values.includes(left.value)));
  const toggle = (value: string, checked: boolean) => onChange(checked ? [...new Set([...values, value])] : values.filter((item) => item !== value));

  return (
    <div className="w-[260px] p-1">
      <button type="button" onClick={() => onChange([])} className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-slate-50">{clearLabel}</button>
      <div className="max-h-52 overflow-y-auto overscroll-contain pr-1">
        {ordered.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-slate-50"><Checkbox checked={values.includes(option.value)} onCheckedChange={(checked) => toggle(option.value, checked)} /><span className="truncate">{option.label}</span></label>)}
      </div>
    </div>
  );
}

export function MultiSelectCombobox({ options, values, onChange, placeholder, searchPlaceholder, clearLabel, selectedLabel, className }: MultiSelectComboboxProps) {
  const isAllSelected = options.length > 0 && options.every((option) => values.includes(option.value));
  const label = values.length ? selectedLabel(values.length, isAllSelected) : placeholder;
  return (
    <Combobox items={options} value="" className={cn(className, "z-30")}>
      <MultiSelectTrigger label={label} searchPlaceholder={searchPlaceholder} />
      <ComboboxContent className="left-0 right-auto mt-1 w-[260px] !max-h-none !overflow-visible border-slate-200 p-0 shadow-lg"><MultiSelectPanel options={options} values={values} onChange={onChange} clearLabel={clearLabel} /></ComboboxContent>
    </Combobox>
  );
}

function MultiSelectTrigger({ label, searchPlaceholder }: { label: string; searchPlaceholder: string }) {
  const { isOpen, setIsOpen, searchQuery, setSearchQuery } = useComboboxContext();
  const openForSearch = () => {
    if (!isOpen) {
      setSearchQuery("");
      setIsOpen(true);
    }
  };

  return (
    <div className="relative flex h-9 w-full items-center rounded-lg border border-slate-200 bg-background pl-8 pr-8 text-xs shadow-xs transition-colors focus-within:border-slate-400">
      <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
      <input value={isOpen ? searchQuery : ""} placeholder={isOpen ? searchPlaceholder : label} onFocus={openForSearch} onClick={openForSearch} onChange={(event) => { setIsOpen(true); setSearchQuery(event.target.value); }} className="h-full w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
    </div>
  );
}
