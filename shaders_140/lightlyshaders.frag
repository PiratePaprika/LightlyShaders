#version 140

uniform sampler2D sampler;
uniform sampler2D mask_sampler;
uniform sampler2D light_outline_sampler;
uniform sampler2D dark_outline_sampler;

uniform vec2 expanded_size;
uniform vec2 frame_size;
uniform vec2 content_size;
uniform vec3 csd_shadow_offset;
uniform vec2 shadow_tex_size;
uniform int radius;
uniform int shadow_sample_offset;
uniform bool is_wayland;
uniform bool has_decoration;
uniform bool draw_outline;
uniform bool dark_theme;
uniform float outline_strength;
uniform float scale;

uniform mat4 modelViewProjectionMatrix;

uniform vec4 modulation;
uniform float saturation;

in vec2 texcoord0;
out vec4 fragColor;

vec4 shapeWindow(vec4 tex, vec4 texCorner)
{
    return vec4(tex.rgb*(1-texCorner.a), min(1-texCorner.a, tex.a));
}

vec4 shapeCSDShadowWindow(float start_x, float start_y, vec4 tex, vec4 texCorner)
{
    vec2 ShadowHorCoord = vec2(texcoord0.x, start_y);
    vec2 ShadowVerCoord = vec2(start_x, texcoord0.y);
    vec2 Shadow0 = vec2(start_x, start_y);

    vec4 texShadowHorCur = texture(sampler, ShadowHorCoord);
    vec4 texShadowVerCur = texture(sampler, ShadowVerCoord);
    vec4 texShadow0 = texture(sampler, Shadow0);

    vec4 texShadow = texShadowHorCur + (texShadowVerCur - texShadow0);
    
    if(texCorner.a == 1) {
        return texShadow;
    } else if(texCorner.a > 0) {
        return mix(vec4(tex.rgb*(1-texCorner.a), min(1-texCorner.a, tex.a)), texShadow, texCorner.a);
    } else {
        return tex;
    }
}

vec4 lightOutline(vec4 outColor, vec4 texOutline, float outline_strength)
{
    if(texOutline.a > outline_strength) texOutline.a = outline_strength;
    vec4 res = vec4(texOutline.rgb*texOutline.a, 0) + vec4((1-texOutline.a)*outColor.rgb, outColor.a);

    if(length(outColor.rgb) - length(res.rgb) > 0) {
        return mix(outColor, res, (length(outColor.rgb) - length(res.rgb))/length(outColor.rgb));
    } else {
        return res;
    }
    
}

vec4 darkOutline(vec4 outColor, vec4 texOutline, float dark_outline_strength)
{
    return mix(outColor, texOutline, ((texOutline.a < dark_outline_strength) ? texOutline.a : dark_outline_strength));
    //if(texOutline.a > dark_outline_strength) texOutline.a = dark_outline_strength;
    //return vec4(texOutline.rgb*texOutline.a, texOutline.a) + (1-texOutline.a)*outColor;
}

void main(void)
{
    vec4 tex = texture(sampler, texcoord0);
    vec2 texture_size = textureSize(sampler, 0);
    vec2 coord0 = vec2(texcoord0.x*texture_size.x, texcoord0.y*texture_size.y);
    vec4 texCorner;
    vec4 outColor;
    float start_x;
    float start_y;

    float mask_tex_size = (radius + shadow_sample_offset)*2;

    float diff_y = 0.0;
    if(is_wayland) {
        diff_y = frame_size.y - content_size.y;
    }

    float dark_outline_strength = outline_strength;
    if(dark_theme) {
        dark_outline_strength = 1;
    }

    //CSD without shadow
    if(expanded_size == frame_size && !has_decoration) {
        coord0 = vec2(texcoord0.x*frame_size.x, texcoord0.y*frame_size.y);
        //Left side
        if (coord0.x < radius) {
            //Top left corner
            if (coord0.y < radius) {
                texCorner = texture(mask_sampler, vec2((coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x + shadow_sample_offset -1 )/mask_tex_size, (coord0.y + shadow_sample_offset -1 )/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2((coord0.x + shadow_sample_offset-1)/mask_tex_size, (coord0.y + shadow_sample_offset-1)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Bottom left corner
            } else if (coord0.y > frame_size.y - radius) {
                texCorner = texture(mask_sampler, vec2((coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (frame_size.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x + shadow_sample_offset -1 )/mask_tex_size, 1 - (frame_size.y - coord0.y + shadow_sample_offset -1 )/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2((coord0.x + shadow_sample_offset-1)/mask_tex_size, 1 - (frame_size.y - coord0.y + shadow_sample_offset -1 )/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Center
            } else {
                outColor = tex;

                //Outline
                if(coord0.y > radius && coord0.y < frame_size.y - radius && draw_outline) {
                    if(coord0.x >= 1 && coord0.x <= 2) {
                        outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                    }

                    //Dark outline
                    if(
                        (coord0.x >= 0 && coord0.x <= 1)
                    ) {
                        outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                    }
                }
            }
        //Right side
        } else if (coord0.x > frame_size.x - radius) {
            //Top right corner
            if (coord0.y < radius) {
                texCorner = texture(mask_sampler, vec2(1 - (frame_size.x - coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2(1 - (frame_size.x - coord0.x + shadow_sample_offset -1 )/mask_tex_size, (coord0.y + shadow_sample_offset -1 )/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2(1 - (frame_size.x - coord0.x + shadow_sample_offset-1)/mask_tex_size, (coord0.y + shadow_sample_offset-1)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Bottom right corner
            } else if (coord0.y > frame_size.y - radius) {
                texCorner = texture(mask_sampler, vec2(1 - (frame_size.x - coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (frame_size.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2(1 - (frame_size.x - coord0.x + shadow_sample_offset -1 )/mask_tex_size, 1 - (frame_size.y - coord0.y + shadow_sample_offset -1 )/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2(1 - (frame_size.x - coord0.x + shadow_sample_offset-1)/mask_tex_size, 1 - (frame_size.y - coord0.y + shadow_sample_offset -1 )/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Center
            } else {
                outColor = tex;

                //Outline
                if(coord0.y > radius && coord0.y < frame_size.y - radius && draw_outline) {
                    if(coord0.x >= frame_size.x -2 && coord0.x <= frame_size.x -1) {
                        outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                    }

                    //Dark outline
                    if(
                        (coord0.x >= frame_size.x -1 && coord0.x <= frame_size.x )
                    ) {
                        outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                    }
                }
            }
        //Center
        } else {
            outColor = tex;

            //Outline
            if(coord0.x > radius && coord0.x < frame_size.x - radius && draw_outline) {
                if(
                    (coord0.y >= frame_size.y -2 && coord0.y <= frame_size.y-1 )
                    || (coord0.y >= 1 && coord0.y <= 2)
                ) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }

                //Dark outline
                if(
                    (coord0.y >= frame_size.y -1  && coord0.y <= frame_size.y)
                    || (coord0.y >= 0 && coord0.y <= 1)
                ) {
                    outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                }
            }
        }
    //CSD with shadow
    } else if(expanded_size != frame_size && !has_decoration) {
        coord0 = vec2(texcoord0.x*expanded_size.x, texcoord0.y*expanded_size.y);
        //Left side
        if (coord0.x > csd_shadow_offset.x - shadow_sample_offset && coord0.x < radius + csd_shadow_offset.x) {
            //Top left corner
            if (coord0.y > csd_shadow_offset.y - shadow_sample_offset && coord0.y < radius + csd_shadow_offset.y) {
                texCorner = texture(mask_sampler, vec2((coord0.x-csd_shadow_offset.x+shadow_sample_offset)/mask_tex_size, (coord0.y-csd_shadow_offset.y+shadow_sample_offset)/mask_tex_size));
                start_x = (csd_shadow_offset.x - shadow_sample_offset)/expanded_size.x;
                start_y = (csd_shadow_offset.y - shadow_sample_offset)/expanded_size.y;
                
                outColor = shapeCSDShadowWindow(start_x, start_y, tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x - csd_shadow_offset.x + shadow_sample_offset)/mask_tex_size, (coord0.y - csd_shadow_offset.y + shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2((coord0.x - csd_shadow_offset.x + shadow_sample_offset)/mask_tex_size, (coord0.y - csd_shadow_offset.y + shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Bottom left corner
            } else if (coord0.y > frame_size.y + csd_shadow_offset.y - radius && coord0.y < frame_size.y + csd_shadow_offset.y + shadow_sample_offset) {
                texCorner = texture(mask_sampler, vec2((coord0.x-csd_shadow_offset.x+shadow_sample_offset)/mask_tex_size, 1 - (frame_size.y + csd_shadow_offset.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                start_x = (csd_shadow_offset.x - shadow_sample_offset)/expanded_size.x;
                start_y = (csd_shadow_offset.y + frame_size.y + shadow_sample_offset)/expanded_size.y;
                
                outColor = shapeCSDShadowWindow(start_x, start_y, tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x - csd_shadow_offset.x + shadow_sample_offset)/mask_tex_size, (coord0.y - frame_size.y - csd_shadow_offset.y - shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2((coord0.x - csd_shadow_offset.x + shadow_sample_offset)/mask_tex_size, (coord0.y - frame_size.y - csd_shadow_offset.y - shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Center
            } else {
                outColor = tex;

                //Outline
                if(coord0.y > radius + csd_shadow_offset.y && coord0.y < csd_shadow_offset.y + frame_size.y - radius && draw_outline) {
                    if(coord0.x >= csd_shadow_offset.x && coord0.x <= csd_shadow_offset.x+1) {
                        outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                    }

                    //Dark outline
                    if(
                        (coord0.x >= csd_shadow_offset.x-1 && coord0.x <= csd_shadow_offset.x)
                    ) {
                        outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                    }
                }
            }
        //Right side
        } else if (coord0.x > csd_shadow_offset.x + frame_size.x - radius && coord0.x < csd_shadow_offset.x + frame_size.x + shadow_sample_offset) {
            //Top right corner
            if (coord0.y > csd_shadow_offset.y - shadow_sample_offset && coord0.y < radius + csd_shadow_offset.y) {
                texCorner = texture(mask_sampler, vec2(1 - (frame_size.x + csd_shadow_offset.x - coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y-csd_shadow_offset.y+shadow_sample_offset)/mask_tex_size));
                start_x = (csd_shadow_offset.x + frame_size.x + shadow_sample_offset)/expanded_size.x;
                start_y = (csd_shadow_offset.y - shadow_sample_offset)/expanded_size.y;
                
                outColor = shapeCSDShadowWindow(start_x, start_y, tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x - frame_size.x - csd_shadow_offset.x - shadow_sample_offset)/mask_tex_size, (coord0.y - csd_shadow_offset.y + shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2((coord0.x - frame_size.x - csd_shadow_offset.x - shadow_sample_offset)/mask_tex_size, (coord0.y - csd_shadow_offset.y + shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Bottom right corner
            } else if (coord0.y > frame_size.y + csd_shadow_offset.y - radius && coord0.y < frame_size.y + csd_shadow_offset.y + shadow_sample_offset) {
                texCorner = texture(mask_sampler, vec2(1 - (frame_size.x + csd_shadow_offset.x - coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (frame_size.y + csd_shadow_offset.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                start_x = (csd_shadow_offset.x + frame_size.x + shadow_sample_offset)/expanded_size.x;
                start_y = (csd_shadow_offset.y + frame_size.y + shadow_sample_offset)/expanded_size.y;
                
                outColor = shapeCSDShadowWindow(start_x, start_y, tex, texCorner);

                //Outline
                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x - frame_size.x - csd_shadow_offset.x - shadow_sample_offset)/mask_tex_size, (coord0.y - frame_size.y - csd_shadow_offset.y - shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }

                    //Dark outline
                    texOutline = texture(dark_outline_sampler, vec2((coord0.x - frame_size.x - csd_shadow_offset.x - shadow_sample_offset)/mask_tex_size, (coord0.y - frame_size.y - csd_shadow_offset.y - shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                    }
                }
            //Center
            } else {
                outColor = tex;

                //Outline
                if(coord0.y > radius + csd_shadow_offset.y && coord0.y < csd_shadow_offset.y + frame_size.y - radius && draw_outline) {
                    if(coord0.x >= frame_size.x + csd_shadow_offset.x-1 && coord0.x <= frame_size.x + csd_shadow_offset.x) {
                        outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                    }

                    //Dark outline
                    if(
                        (coord0.x >= frame_size.x + csd_shadow_offset.x && coord0.x <= frame_size.x + csd_shadow_offset.x+1)
                    ) {
                        outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                    }
                }
            }
        //Center
        } else {
            outColor = tex;

            //Outline
            if(coord0.x > radius + csd_shadow_offset.x && coord0.x < csd_shadow_offset.x + frame_size.x - radius && draw_outline) {
                if(
                    (coord0.y >= frame_size.y + csd_shadow_offset.y-1 && coord0.y <= frame_size.y + csd_shadow_offset.y)
                    || (coord0.y >= csd_shadow_offset.y && coord0.y <= csd_shadow_offset.y+1)
                ) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }

                //Dark outline
                if(
                    (coord0.y >= frame_size.y + csd_shadow_offset.y && coord0.y <= frame_size.y + csd_shadow_offset.y + 1)
                    || (coord0.y >= csd_shadow_offset.y-1 && coord0.y <= csd_shadow_offset.y)
                ) {
                    outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                }
            }
        }
    //Window shadow or titlebar
    } else if(((is_wayland && texture_size != content_size) || (!is_wayland && texture_size != frame_size)) && !(is_wayland && texture_size == frame_size)) {
        outColor = tex;

        //Titlebar outline
        if(texture_size != shadow_tex_size && draw_outline) {
            //Left side
            if (coord0.x < radius) {
                if (coord0.x <= 2.0 && coord0.y > radius) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }

                //Top left corner
                if (coord0.y < radius) {
                    if(draw_outline) {
                        vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x+shadow_sample_offset-1)/mask_tex_size, (coord0.y+shadow_sample_offset-1)/mask_tex_size));
                        if(texOutline.a > 0) {
                            outColor = lightOutline(outColor, texOutline, outline_strength);
                        }
                    }
                }

            //Right side
            } else if (coord0.x > frame_size.x - radius) {
                if (coord0.x >= frame_size.x && coord0.y > radius) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }            

                //Top right corner
                if (coord0.y < radius) {
                    if(draw_outline) {
                        vec4 texOutline = texture(light_outline_sampler, vec2(1 - (frame_size.x - coord0.x+1+shadow_sample_offset)/mask_tex_size, (coord0.y-1+shadow_sample_offset)/mask_tex_size));
                        if(texOutline.a > 0) {
                            outColor = lightOutline(outColor, texOutline, outline_strength);
                        }
                    }
                }
            //Center
            } else {
                if(coord0.y >=1.0 && coord0.y <= 2.0 ) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }
            }
        }

        //Shadow (outer dark) outline
        if(texture_size == shadow_tex_size && draw_outline) {
            float radius_unscaled = radius/scale;
            vec3 csd_shadow_offset_unscaled = csd_shadow_offset/scale;
            float mask_tex_size_unscaled = mask_tex_size/scale;
            float shadow_sample_offset_unscaled = shadow_sample_offset/scale;
            //Left side
            if (coord0.x < radius_unscaled + csd_shadow_offset_unscaled.x) {
                if (
                    coord0.x >= csd_shadow_offset_unscaled.x-1/scale && coord0.x < csd_shadow_offset_unscaled.x
                    && coord0.y > radius_unscaled+csd_shadow_offset_unscaled.y && coord0.y < texture_size.y - csd_shadow_offset_unscaled.z - radius_unscaled
                ) {
                    outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                }

                //Top left corner
                if (
                    coord0.y > csd_shadow_offset_unscaled.y - shadow_sample_offset_unscaled && coord0.y < csd_shadow_offset_unscaled.y + radius_unscaled
                    && coord0.x > csd_shadow_offset_unscaled.x - shadow_sample_offset_unscaled && coord0.x < csd_shadow_offset_unscaled.x + radius_unscaled
                ) {
                    if(draw_outline) {
                        vec4 texOutline = texture(dark_outline_sampler, vec2((coord0.x - csd_shadow_offset_unscaled.x + shadow_sample_offset_unscaled)/mask_tex_size_unscaled, (coord0.y - csd_shadow_offset_unscaled.y + shadow_sample_offset_unscaled)/mask_tex_size_unscaled));
                        if(texOutline.a > 0) {
                            outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                        }
                    }
                //Bottom left corner
                } else if (
                    coord0.y > texture_size.y - csd_shadow_offset_unscaled.z - radius_unscaled && coord0.y < texture_size.y - csd_shadow_offset_unscaled.z + shadow_sample_offset_unscaled
                    && coord0.x > csd_shadow_offset_unscaled.x - shadow_sample_offset_unscaled && coord0.x < csd_shadow_offset_unscaled.x + radius_unscaled
                ) {
                    if(draw_outline) {
                        vec4 texOutline = texture(dark_outline_sampler, vec2((coord0.x - csd_shadow_offset_unscaled.x + shadow_sample_offset_unscaled)/mask_tex_size_unscaled, 1 - (texture_size.y - coord0.y - csd_shadow_offset_unscaled.z + shadow_sample_offset_unscaled)/mask_tex_size_unscaled));
                        if(texOutline.a > 0) {
                            outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                        }
                    }
                }
            //Right side
            } else if (coord0.x > texture_size.x - csd_shadow_offset_unscaled.x - radius_unscaled) {
                if (
                    coord0.x > texture_size.x - csd_shadow_offset_unscaled.x && coord0.x <= texture_size.x - csd_shadow_offset_unscaled.x + 1/scale
                    && coord0.y > radius_unscaled+csd_shadow_offset_unscaled.y && coord0.y < texture_size.y - csd_shadow_offset_unscaled.z - radius_unscaled
                ) {
                    outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                }

                //Top right corner
                if (
                    coord0.y > csd_shadow_offset_unscaled.y - shadow_sample_offset_unscaled && coord0.y < csd_shadow_offset_unscaled.y + radius_unscaled
                    && coord0.x < texture_size.x - csd_shadow_offset_unscaled.x + shadow_sample_offset_unscaled
                ) {
                    if(draw_outline) {
                        vec4 texOutline = texture(dark_outline_sampler, vec2(1 - (texture_size.x - csd_shadow_offset_unscaled.x - coord0.x+shadow_sample_offset_unscaled)/mask_tex_size_unscaled, (coord0.y - csd_shadow_offset_unscaled.y +shadow_sample_offset_unscaled)/mask_tex_size_unscaled));
                        if(texOutline.a > 0) {
                            outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                        }
                    }
                //Bottom right corner
                } else if (
                    coord0.y > texture_size.y - csd_shadow_offset_unscaled.z - radius_unscaled && coord0.y < texture_size.y - csd_shadow_offset_unscaled.z + shadow_sample_offset_unscaled
                    && coord0.x < texture_size.x - csd_shadow_offset_unscaled.x + shadow_sample_offset_unscaled
                ) {
                    if(draw_outline) {
                        vec4 texOutline = texture(dark_outline_sampler, vec2(1 - (texture_size.x - csd_shadow_offset_unscaled.x - coord0.x+shadow_sample_offset_unscaled)/mask_tex_size_unscaled, 1 - (texture_size.y - coord0.y - csd_shadow_offset_unscaled.z + shadow_sample_offset_unscaled)/mask_tex_size_unscaled));
                        if(texOutline.a > 0) {
                            outColor = darkOutline(outColor, texOutline, dark_outline_strength);
                        }
                    }
                }
            //Center
            } else {
                if(
                    coord0.y >= csd_shadow_offset_unscaled.y - 1.0/scale && coord0.y < csd_shadow_offset_unscaled.y 
                    || coord0.y > texture_size.y - csd_shadow_offset_unscaled.z && coord0.y <= texture_size.y - csd_shadow_offset_unscaled.z + 1/scale
                ) {
                    outColor = mix(outColor, vec4(0,0,0,1), dark_outline_strength);
                }
            }
        }

    //Window content
    } else {
        //Left side
        if (coord0.x < radius) {
            //Top left corner
            if (coord0.y+diff_y < radius) {
                texCorner = texture(mask_sampler, vec2((coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y+diff_y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y+diff_y+shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }
                }
            //Bottom left corner
            } else if (coord0.y > texture_size.y - radius) {
                texCorner = texture(mask_sampler, vec2((coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (texture_size.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2((coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (texture_size.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }
                }
            //Center
            } else {
                outColor = tex;

                //Outline
                if(coord0.x >= 0 && coord0.x <= 1 && draw_outline) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }
            }
        //Right side
        } else if (coord0.x > texture_size.x - radius) {
            //Top right corner
            if (coord0.y+diff_y < radius) {
                texCorner = texture(mask_sampler, vec2(1 - (texture_size.x - coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y+diff_y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2(1 - (texture_size.x - coord0.x+shadow_sample_offset)/mask_tex_size, (coord0.y+diff_y+shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }
                }
            //Bottom right corner
            } else if (coord0.y > texture_size.y - radius) {
                texCorner = texture(mask_sampler, vec2(1 - (texture_size.x - coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (texture_size.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                
                outColor = shapeWindow(tex, texCorner);

                if(draw_outline) {
                    vec4 texOutline = texture(light_outline_sampler, vec2(1 - (texture_size.x - coord0.x+shadow_sample_offset)/mask_tex_size, 1 - (texture_size.y - coord0.y+shadow_sample_offset)/mask_tex_size));
                    if(texOutline.a > 0) {
                        outColor = lightOutline(outColor, texOutline, outline_strength);
                    }
                }
            //Center
            } else {
                outColor = tex;

                //Outline
                if(coord0.x >= texture_size.x-1 && coord0.x <= texture_size.x && draw_outline) {
                    outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
                }
            }
        //Center
        } else {
            outColor = tex;

            //Outline
            if(coord0.y >= texture_size.y-1 && coord0.y <= texture_size.y && draw_outline) {
                outColor = mix(outColor, vec4(1,1,1,1), outline_strength);
            }
        }
    }


    //Support opacity
    if (saturation != 1.0) {
        vec3 desaturated = outColor.rgb * vec3( 0.30, 0.59, 0.11 );
        desaturated = vec3( dot( desaturated, outColor.rgb ));
        outColor.rgb = outColor.rgb * vec3( saturation ) + desaturated * vec3( 1.0 - saturation );
    }
    outColor *= modulation;
    
    //Output result
    fragColor = outColor;
}
