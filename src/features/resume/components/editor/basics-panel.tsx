"use client";

/**
 * The header block: name, contact details, photo, and social links.
 *
 * Not a section, and deliberately not reorderable or hideable — every template
 * prints this at the top, and a resume with no way to contact its author is not a
 * resume. So it sits above the section list rather than inside it.
 */

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PHOTO_SHAPES,
  RESUME_LIMITS,
  SOCIAL_NETWORKS,
  isSafeHttpUrl,
  type PhotoShape,
} from "@/types/resume";

import { selectBasics, useResumeStore } from "../../store/resume-store";
import { FieldGrid, SelectField, SwitchField, TextField } from "./editor-fields";
import { SortableHandle, SortableList, SortableRow } from "./sortable-list";

const SHAPE_OPTIONS = PHOTO_SHAPES.map((shape) => ({
  value: shape,
  label: `${shape.charAt(0).toUpperCase()}${shape.slice(1)}`,
}));

const NETWORK_SUGGESTIONS = SOCIAL_NETWORKS.join(", ");

export function BasicsPanel() {
  const basics = useResumeStore(selectBasics);
  const setBasics = useResumeStore((state) => state.setBasics);
  const setPhoto = useResumeStore((state) => state.setPhoto);
  const addSocial = useResumeStore((state) => state.addSocial);
  const updateSocial = useResumeStore((state) => state.updateSocial);
  const removeSocial = useResumeStore((state) => state.removeSocial);
  const moveSocial = useResumeStore((state) => state.moveSocial);

  const socialIds = basics.socials.map((social) => social.id);
  const photoUrlUnusable = basics.photo.url.length > 0 && !isSafeHttpUrl(basics.photo.url);

  return (
    <div className="space-y-4">
      <FieldGrid>
        <TextField
          label="Full name"
          value={basics.fullName}
          maxLength={RESUME_LIMITS.nameText}
          autoComplete="name"
          placeholder="Naroz Ezzat"
          onChange={(fullName) => setBasics({ fullName }, "basics:fullName")}
        />
        <TextField
          label="Headline"
          value={basics.headline}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Senior Frontend Engineer"
          hint="The one line under your name. Not a job title you want — one you can back up."
          onChange={(headline) => setBasics({ headline }, "basics:headline")}
        />
        <TextField
          label="Email"
          type="email"
          value={basics.email}
          maxLength={RESUME_LIMITS.shortText}
          autoComplete="email"
          onChange={(email) => setBasics({ email }, "basics:email")}
        />
        <TextField
          label="Phone"
          type="tel"
          value={basics.phone}
          maxLength={RESUME_LIMITS.phoneText}
          autoComplete="tel"
          placeholder="+20 100 000 0000"
          onChange={(phone) => setBasics({ phone }, "basics:phone")}
        />
        <TextField
          label="Location"
          value={basics.location}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Cairo, Egypt"
          onChange={(location) => setBasics({ location }, "basics:location")}
        />
        <TextField
          label="Website"
          type="url"
          value={basics.website}
          maxLength={RESUME_LIMITS.urlText}
          placeholder="https://yoursite.com"
          onChange={(website) => setBasics({ website }, "basics:website")}
        />
      </FieldGrid>

      {/* ── Photo ── */}
      <div className="space-y-3 rounded-xl border border-border/70 p-3">
        <SwitchField
          label="Show a photo"
          checked={basics.photo.visible}
          hint="Off by default. Several ATS parsers drop the surrounding block, and in some countries a photo may not be considered at all."
          onChange={(visible) => setPhoto({ visible })}
        />

        {basics.photo.visible ? (
          <FieldGrid>
            <TextField
              label="Photo URL"
              type="url"
              value={basics.photo.url}
              maxLength={RESUME_LIMITS.urlText}
              placeholder="https://…"
              hint={photoUrlUnusable ? undefined : "A direct link to an image file."}
              onChange={(url) => setPhoto({ url })}
            />
            <SelectField
              label="Shape"
              value={basics.photo.shape}
              options={SHAPE_OPTIONS}
              placeholder="Circle"
              onChange={(shape) => setPhoto({ shape: shape as PhotoShape })}
            />
          </FieldGrid>
        ) : null}

        {basics.photo.visible && photoUrlUnusable ? (
          <p className="text-xs font-medium text-destructive">
            That link will not render. Use a full http:// or https:// URL to an image.
          </p>
        ) : null}
      </div>

      {/* ── Socials ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Links</h3>
          <span className="text-xs text-muted-foreground" aria-hidden>
            {basics.socials.length} / {RESUME_LIMITS.socials}
          </span>
        </div>

        {basics.socials.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
            LinkedIn and GitHub are the two most recruiters look for. Suggested names:{" "}
            {NETWORK_SUGGESTIONS}.
          </p>
        ) : (
          <SortableList
            ids={socialIds}
            onMove={moveSocial}
            labelFor={(id) => basics.socials.find((social) => social.id === id)?.network ?? ""}
            itemNoun="link"
          >
            <ul className="space-y-2">
              {basics.socials.map((social) => {
                const label = social.network.trim() || "Untitled link";
                const urlUnusable = social.url.length > 0 && !isSafeHttpUrl(social.url);

                return (
                  <li key={social.id}>
                    <SortableRow id={social.id}>
                      {({ handleProps, isDragging }) => (
                        <div
                          className={cn(
                            "flex items-start gap-1.5 rounded-xl border border-border/70 bg-card/60 p-2 transition-shadow",
                            isDragging && "shadow-lg ring-1 ring-ring/30",
                          )}
                        >
                          <SortableHandle label={label} className="mt-6" {...handleProps} />

                          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                            <TextField
                              label="Network"
                              value={social.network}
                              maxLength={RESUME_LIMITS.nameText}
                              placeholder="LinkedIn"
                              onChange={(network) =>
                                updateSocial(social.id, { network }, `social:${social.id}:network`)
                              }
                            />
                            <TextField
                              label="Username"
                              value={social.username}
                              maxLength={RESUME_LIMITS.nameText}
                              placeholder="narozezzat"
                              onChange={(username) =>
                                updateSocial(
                                  social.id,
                                  { username },
                                  `social:${social.id}:username`,
                                )
                              }
                            />
                            <TextField
                              label="URL"
                              type="url"
                              value={social.url}
                              maxLength={RESUME_LIMITS.urlText}
                              placeholder="https://linkedin.com/in/…"
                              hint={urlUnusable ? "Needs a full https:// link." : undefined}
                              onChange={(url) =>
                                updateSocial(social.id, { url }, `social:${social.id}:url`)
                              }
                            />
                          </div>

                          <IconButton
                            label={`Remove ${label}`}
                            icon={<Trash2 aria-hidden className="size-3.5" />}
                            size="icon-sm"
                            className="mt-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeSocial(social.id)}
                          />
                        </div>
                      )}
                    </SortableRow>
                  </li>
                );
              })}
            </ul>
          </SortableList>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!addSocial()) {
              toast.error(`You can add up to ${RESUME_LIMITS.socials} links.`);
            }
          }}
        >
          <Plus aria-hidden className="size-3.5" />
          Add link
        </Button>
      </div>
    </div>
  );
}
